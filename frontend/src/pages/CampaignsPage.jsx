import { useEffect, useState } from 'react';
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
import { Plus, Clock, CheckCircle, XCircle, Send, Trash2, Pause, Play, Image } from 'lucide-react';

export default function CampaignsPage() {
  const { campaigns, fetchCampaigns, pauseCampaign, resumeCampaign, deleteCampaign, loading } = useCampaignsStore();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handlePause = async (campaign) => {
    setActionLoading(true);
    try {
      await pauseCampaign(campaign.id);
      toast.success('Campanha pausada');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao pausar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (campaign) => {
    setActionLoading(true);
    try {
      await resumeCampaign(campaign.id);
      toast.success('Campanha retomada');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao retomar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!campaignToDelete) return;
    setActionLoading(true);
    try {
      await deleteCampaign(campaignToDelete.id);
      toast.success('Campanha deletada');
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao deletar');
    } finally {
      setActionLoading(false);
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

  const getScheduleLabel = (campaign) => {
    if (campaign.schedule_type === 'once') {
      return 'Disparo único';
    } else if (campaign.schedule_type === 'interval') {
      return `A cada ${campaign.interval_hours}h`;
    } else if (campaign.schedule_type === 'specific_times') {
      return `${campaign.specific_times?.length || 0} horários/dia`;
    }
    return '';
  };

  const stats = [
    { label: 'Total', value: campaigns.length },
    { label: 'Ativas', value: campaigns.filter(c => ['pending', 'active', 'running'].includes(c.status)).length, color: 'text-blue-400' },
    { label: 'Concluídas', value: campaigns.filter(c => c.status === 'completed').length, color: 'text-primary' },
  ];

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
              <span className={`font-heading font-bold text-xl ${stat.color || ''}`}>{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Send className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg mb-2">Nenhuma campanha</h3>
            <p className="text-muted-foreground text-sm mb-4">Crie sua primeira campanha</p>
            <Button onClick={() => navigate('/campaigns/new')} className="bg-primary text-primary-foreground">
              Criar Campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign, index) => (
            <Card
              key={campaign.id}
              data-testid={`campaign-card-${campaign.id}`}
              className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{campaign.title}</h3>
                      {getStatusBadge(campaign.status)}
                      {campaign.image_url && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-white/10">
                          <Image className="w-3 h-3" />
                          Imagem
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{campaign.total_count} grupos</span>
                      <span>{getScheduleLabel(campaign)}</span>
                      {campaign.scheduled_time && (
                        <span>{new Date(campaign.scheduled_time).toLocaleString('pt-BR')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Progress */}
                    <div className="hidden sm:block w-24">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Enviados</span>
                        <span>{campaign.sent_count}/{campaign.total_count}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            campaign.status === 'completed' ? 'bg-primary' :
                            campaign.status === 'failed' ? 'bg-destructive' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${(campaign.sent_count / campaign.total_count) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      {campaign.status === 'active' && (
                        <Button
                          onClick={() => handlePause(campaign)}
                          disabled={actionLoading}
                          variant="outline"
                          size="icon"
                          className="border-white/10 h-8 w-8"
                        >
                          <Pause className="w-4 h-4" />
                        </Button>
                      )}
                      {campaign.status === 'paused' && (
                        <Button
                          onClick={() => handleResume(campaign)}
                          disabled={actionLoading}
                          variant="outline"
                          size="icon"
                          className="border-white/10 h-8 w-8"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        data-testid={`delete-campaign-${campaign.id}`}
                        onClick={() => {
                          setCampaignToDelete(campaign);
                          setDeleteDialogOpen(true);
                        }}
                        variant="outline"
                        size="icon"
                        className="border-destructive/20 text-destructive hover:bg-destructive/10 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Message Preview */}
                {campaign.message && (
                  <div className="mt-3 p-3 bg-background/30 rounded-lg border border-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Mensagem:</p>
                    <p className="text-sm line-clamp-2">{campaign.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-white/10 mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Campanha</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar "{campaignToDelete?.title}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-campaign"
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Deletando...' : 'Deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
