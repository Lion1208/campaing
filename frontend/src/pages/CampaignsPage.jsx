import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignsStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Clock, CheckCircle, XCircle, Send, Trash2, Pause, Play, Image, Copy, Zap, Calendar, Users, Edit2, Timer, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/store';

// Componente de timer em tempo real para cada card
function CampaignTimer({ campaign }) {
  const [timeLeft, setTimeLeft] = useState('');
  
  useEffect(() => {
    // Só mostra timer para campanhas ativas com intervalo
    if (campaign.status !== 'active' && campaign.status !== 'running') {
      setTimeLeft('');
      return;
    }
    
    // Calcula o próximo envio baseado no last_run ou next_run
    const calculateNextRun = () => {
      if (campaign.next_run) {
        return new Date(campaign.next_run).getTime();
      }
      
      // Se tem last_run e interval_hours, calcula
      if (campaign.last_run && campaign.interval_hours) {
        const lastRun = new Date(campaign.last_run).getTime();
        return lastRun + (campaign.interval_hours * 60 * 60 * 1000);
      }
      
      return null;
    };
    
    const calculateTimeLeft = () => {
      const targetTime = calculateNextRun();
      if (!targetTime) return '';
      
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        return 'Enviando...';
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [campaign.next_run, campaign.last_run, campaign.interval_hours, campaign.status]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs bg-primary/20 text-primary px-2 py-1 rounded-full animate-pulse">
      <Timer className="w-3 h-3" />
      <span className="font-mono font-medium">{timeLeft}</span>
    </div>
  );
}

// Componente de próximo horário específico
function NextScheduleTime({ campaign }) {
  const [nextTime, setNextTime] = useState('');
  
  useEffect(() => {
    if (campaign.schedule_type !== 'specific_times' || !campaign.specific_times?.length) {
      setNextTime('');
      return;
    }
    
    const calculateNext = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const sortedTimes = [...campaign.specific_times].sort();
      return sortedTimes.find(t => t > currentTime) || sortedTimes[0] + ' (amanhã)';
    };
    
    setNextTime(calculateNext());
    const interval = setInterval(() => {
      setNextTime(calculateNext());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [campaign.specific_times, campaign.schedule_type]);

  if (!nextTime || campaign.status !== 'active') return null;

  return (
    <span className="text-xs text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
      Próximo: {nextTime}
    </span>
  );
}
}

export default function CampaignsPage() {
  const { campaigns, fetchCampaigns, startCampaign, duplicateCampaign, pauseCampaign, resumeCampaign, deleteCampaign, loading } = useCampaignsStore();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [paginatedCampaigns, setPaginatedCampaigns] = useState([]);
  const limit = 12;

  const fetchPaginatedCampaigns = useCallback(async () => {
    try {
      const response = await api.get(`/campaigns/paginated?page=${page}&limit=${limit}`);
      setPaginatedCampaigns(response.data.campaigns);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  }, [page]);

  useEffect(() => {
    fetchPaginatedCampaigns();
    fetchCampaigns(); // Also fetch for store
    
    // Refresh every 10 seconds to update timers and status
    const interval = setInterval(fetchPaginatedCampaigns, 10000);
    return () => clearInterval(interval);
  }, [fetchPaginatedCampaigns, fetchCampaigns]);

  const handleStart = async (campaign) => {
    setActionLoading(campaign.id);
    try {
      const result = await startCampaign(campaign.id);
      toast.success(result.message || 'Campanha iniciada!');
      fetchPaginatedCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao iniciar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (campaign) => {
    setActionLoading(campaign.id);
    try {
      await duplicateCampaign(campaign.id);
      toast.success('Campanha duplicada!');
      fetchPaginatedCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao duplicar');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePause = async (campaign) => {
    setActionLoading(campaign.id);
    try {
      await pauseCampaign(campaign.id);
      toast.success('Campanha pausada');
      fetchPaginatedCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao pausar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (campaign) => {
    setActionLoading(campaign.id);
    try {
      await resumeCampaign(campaign.id);
      toast.success('Campanha retomada');
      fetchPaginatedCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao retomar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!campaignToDelete) return;
    setActionLoading(campaignToDelete.id);
    try {
      await deleteCampaign(campaignToDelete.id);
      toast.success('Campanha deletada');
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
      fetchPaginatedCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao deletar');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { class: 'status-pending', label: 'Pendente', icon: Clock },
      running: { class: 'status-running', label: 'Enviando', icon: Send },
      completed: { class: 'status-completed', label: 'Concluída', icon: CheckCircle },
      failed: { class: 'status-failed', label: 'Falhou', icon: XCircle },
      active: { class: 'status-active', label: 'Ativa', icon: Play },
      paused: { class: 'status-paused', label: 'Pausada', icon: Pause },
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <Badge variant="outline" className={`${c.class} text-[10px] uppercase tracking-wider gap-1`}>
        <Icon className="w-3 h-3" />
        {c.label}
      </Badge>
    );
  };

  const getScheduleInfo = (campaign) => {
    if (campaign.schedule_type === 'once') {
      return { label: 'Único', detail: campaign.scheduled_time ? new Date(campaign.scheduled_time).toLocaleString('pt-BR') : '-' };
    } else if (campaign.schedule_type === 'interval') {
      return { label: `A cada ${campaign.interval_hours}h`, detail: null };
    } else if (campaign.schedule_type === 'specific_times') {
      const times = campaign.specific_times || [];
      return { label: `${times.length} horário${times.length > 1 ? 's' : ''}`, detail: times.join(', ') };
    }
    return { label: '-', detail: null };
  };

  const stats = [
    { label: 'Total', value: campaigns.length },
    { label: 'Ativas', value: campaigns.filter(c => ['pending', 'active', 'running'].includes(c.status)).length, color: 'text-blue-400' },
    { label: 'Concluídas', value: campaigns.filter(c => c.status === 'completed').length, color: 'text-primary' },
  ];

  const canStart = (status) => ['pending', 'paused'].includes(status);
  const canPause = (status) => ['active', 'running'].includes(status);
  const canResume = (status) => status === 'paused';
  const canEdit = (status) => !['running'].includes(status);

  // Get image URL - check both image_url and messages array
  const getImageUrl = (campaign) => {
    if (campaign.image_url) {
      return `${process.env.REACT_APP_BACKEND_URL}${campaign.image_url}`;
    }
    if (campaign.messages && campaign.messages.length > 0 && campaign.messages[0].image_url) {
      return `${process.env.REACT_APP_BACKEND_URL}${campaign.messages[0].image_url}`;
    }
    return null;
  };

  return (
    <div data-testid="campaigns-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Campanhas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie suas campanhas de mensagens</p>
        </div>
        <Button
          data-testid="create-campaign-btn"
          onClick={() => navigate('/campaigns/new')}
          className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-card flex-shrink-0">
            <CardContent className="p-3 flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className={`font-heading font-bold text-xl ${stat.color || 'text-foreground'}`}>{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns Grid */}
      {loading && paginatedCampaigns.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paginatedCampaigns.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Send className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">Nenhuma campanha</h3>
            <p className="text-muted-foreground text-sm mb-4">Crie sua primeira campanha</p>
            <Button onClick={() => navigate('/campaigns/new')} className="bg-primary text-primary-foreground">
              Criar Campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {paginatedCampaigns.map((campaign, index) => {
            const scheduleInfo = getScheduleInfo(campaign);
            const imageUrl = getImageUrl(campaign);
            
            return (
              <Card
                key={campaign.id}
                data-testid={`campaign-card-${campaign.id}`}
                className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1} overflow-hidden flex flex-col`}
              >
                {/* Image Preview */}
                <div className="h-28 bg-muted/20 relative overflow-hidden flex-shrink-0">
                  {imageUrl ? (
                    <>
                      <img 
                        src={imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-10 h-10 text-muted-foreground/20" />
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="absolute top-2 left-2">
                    {getStatusBadge(campaign.status)}
                  </div>
                  {/* Timer */}
                  <div className="absolute top-2 right-2">
                    <CampaignTimer campaign={campaign} />
                  </div>
                </div>

                <CardContent className="p-4 flex flex-col flex-1">
                  {/* Title */}
                  <h3 className="font-semibold text-foreground truncate mb-1">{campaign.title}</h3>

                  {/* Message Preview */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1 min-h-[2.5rem]">
                    {campaign.message || (campaign.messages && campaign.messages[0]?.message) || <span className="italic">Sem mensagem de texto</span>}
                  </p>

                  {/* Info */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {campaign.total_count} grupos
                    </span>
                    <span className="flex items-center gap-1" title={scheduleInfo.detail || ''}>
                      <Calendar className="w-3 h-3" />
                      {scheduleInfo.label}
                    </span>
                  </div>

                  {/* Next schedule for specific times */}
                  {campaign.status === 'active' && (
                    <div className="mb-2">
                      <NextScheduleTime campaign={campaign} />
                    </div>
                  )}

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-muted-foreground">Enviados</span>
                      <span className="text-foreground font-medium">{campaign.sent_count}/{campaign.total_count}</span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          campaign.status === 'completed' ? 'bg-primary' :
                          campaign.status === 'failed' ? 'bg-destructive' : 
                          campaign.status === 'running' ? 'bg-yellow-500' : 'bg-primary/50'
                        }`}
                        style={{ width: `${campaign.total_count > 0 ? (campaign.sent_count / campaign.total_count) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 mt-auto">
                    {/* Start/Resume Button */}
                    {canStart(campaign.status) && (
                      <Button
                        onClick={() => canResume(campaign.status) ? handleResume(campaign) : handleStart(campaign)}
                        disabled={actionLoading === campaign.id}
                        size="sm"
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-8"
                      >
                        <Zap className="w-3.5 h-3.5 mr-1" />
                        {canResume(campaign.status) ? 'Retomar' : 'Iniciar'}
                      </Button>
                    )}

                    {/* Pause Button */}
                    {canPause(campaign.status) && (
                      <Button
                        onClick={() => handlePause(campaign)}
                        disabled={actionLoading === campaign.id}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-border h-8"
                      >
                        <Pause className="w-3.5 h-3.5 mr-1" />
                        Pausar
                      </Button>
                    )}

                    {/* Edit Button */}
                    {canEdit(campaign.status) && (
                      <Button
                        onClick={() => navigate(`/campaigns/edit/${campaign.id}`)}
                        variant="outline"
                        size="icon"
                        className="border-border h-8 w-8"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    {/* Duplicate Button */}
                    <Button
                      onClick={() => handleDuplicate(campaign)}
                      disabled={actionLoading === campaign.id}
                      variant="outline"
                      size="icon"
                      className="border-border h-8 w-8"
                      title="Duplicar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete Button */}
                    <Button
                      data-testid={`delete-campaign-${campaign.id}`}
                      onClick={() => {
                        setCampaignToDelete(campaign);
                        setDeleteDialogOpen(true);
                      }}
                      variant="outline"
                      size="icon"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 h-8 w-8"
                      title="Deletar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-border"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-border"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-border mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deletar Campanha</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar "{campaignToDelete?.title}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-campaign"
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
