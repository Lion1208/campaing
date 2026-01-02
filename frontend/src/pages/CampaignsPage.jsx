import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignsStore, useAuthStore } from '@/store';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Clock, CheckCircle, XCircle, Send, Trash2, Pause, Play, Image, Copy, Zap, Calendar, Users, Edit2, Timer, ChevronLeft, ChevronRight, FolderInput, Replace, MoreVertical, Filter } from 'lucide-react';
import { api } from '@/store';

// Componente de timer em tempo real para cada card
function CampaignTimer({ campaign }) {
  const [timeLeft, setTimeLeft] = useState(() => {
    if (campaign.status !== 'active' && campaign.status !== 'running') {
      return '';
    }
    return calculateTimeLeftForCampaign(campaign);
  });
  
  useEffect(() => {
    if (campaign.status !== 'active' && campaign.status !== 'running') {
      return;
    }
    
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeftForCampaign(campaign));
    }, 1000);

    return () => clearInterval(interval);
  }, [campaign]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs bg-primary/20 text-primary px-2 py-1 rounded-full animate-pulse">
      <Timer className="w-3 h-3" />
      <span className="font-mono font-medium">{timeLeft}</span>
    </div>
  );
}

// Helper function for timer calculation - ADAPTED to schedule_type
function calculateTimeLeftForCampaign(campaign) {
  let targetTime = null;
  
  // IMPORTANTE: Usar schedule_type para determinar como calcular
  if (campaign.schedule_type === 'specific_times' && campaign.specific_times?.length > 0) {
    // Para horários específicos, calcular o próximo horário do dia
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
    
    // Encontrar o próximo horário
    const sortedTimes = [...campaign.specific_times].sort();
    let nextTimeStr = sortedTimes.find(t => t > currentTimeStr);
    
    if (nextTimeStr) {
      // Próximo horário é hoje
      const [hours, minutes] = nextTimeStr.split(':').map(Number);
      targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0).getTime();
    } else {
      // Próximo horário é amanhã (primeiro horário da lista)
      const [hours, minutes] = sortedTimes[0].split(':').map(Number);
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
      targetTime = tomorrow.getTime();
    }
  } else if (campaign.schedule_type === 'interval' && campaign.interval_hours) {
    // Para intervalo, usar last_run + interval_hours
    if (campaign.last_run) {
      const lastRun = new Date(campaign.last_run).getTime();
      targetTime = lastRun + (campaign.interval_hours * 60 * 60 * 1000);
    } else if (campaign.next_run) {
      targetTime = new Date(campaign.next_run).getTime();
    }
  } else if (campaign.schedule_type === 'once' && campaign.scheduled_time) {
    // Para disparo único
    targetTime = new Date(campaign.scheduled_time).getTime();
  } else if (campaign.next_run) {
    // Fallback para next_run se existir
    targetTime = new Date(campaign.next_run).getTime();
  }
  
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
}

// Componente de próximo horário específico
function NextScheduleTime({ campaign }) {
  const calculateNext = useCallback(() => {
    if (campaign.schedule_type !== 'specific_times' || !campaign.specific_times?.length) {
      return '';
    }
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const sortedTimes = [...campaign.specific_times].sort();
    return sortedTimes.find(t => t > currentTime) || sortedTimes[0] + ' (amanhã)';
  }, [campaign.schedule_type, campaign.specific_times]);

  const [nextTime, setNextTime] = useState(calculateNext);
  
  useEffect(() => {
    if (campaign.schedule_type !== 'specific_times' || !campaign.specific_times?.length) {
      return;
    }
    
    const interval = setInterval(() => {
      setNextTime(calculateNext());
    }, 60000);
    
    return () => clearInterval(interval);
  }, [campaign.specific_times, campaign.schedule_type, calculateNext]);

  if (!nextTime || campaign.status !== 'active') return null;

  return (
    <span className="text-xs text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
      Próximo: {nextTime}
    </span>
  );
}

// Componente de preview animado para campanhas com múltiplas variações
function AnimatedCampaignPreview({ campaign, imageCache, loadImagePreview }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const messages = campaign.messages || [];
  const hasMultiple = messages.length > 1;
  
  // Calculate current image from cache
  const currentImage = useMemo(() => {
    if (messages.length === 0) {
      const imageId = campaign.image_id;
      const cacheKey = `${campaign.id}_${imageId}`;
      return imageId ? imageCache[cacheKey] || null : null;
    }
    
    const currentMsg = messages[currentIndex];
    const imageId = currentMsg?.image_id;
    const cacheKey = `${campaign.id}_${currentIndex}`;
    
    return imageId ? imageCache[cacheKey] || null : null;
  }, [messages, currentIndex, campaign.id, campaign.image_id, imageCache]);
  
  // Load image for current variation
  useEffect(() => {
    if (messages.length === 0) {
      const imageId = campaign.image_id;
      if (imageId && !imageCache[`${campaign.id}_${imageId}`]) {
        loadImagePreview(imageId, `${campaign.id}_${imageId}`);
      }
      return;
    }
    
    const currentMsg = messages[currentIndex];
    const imageId = currentMsg?.image_id;
    const cacheKey = `${campaign.id}_${currentIndex}`;
    
    if (imageId && !imageCache[cacheKey]) {
      loadImagePreview(imageId, cacheKey);
    }
  }, [currentIndex, messages, campaign.id, campaign.image_id, imageCache, loadImagePreview]);
  
  // Animation timer for multiple variations
  useEffect(() => {
    if (!hasMultiple) return;
    
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % messages.length);
        setIsTransitioning(false);
      }, 300);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [hasMultiple, messages.length]);
  
  return (
    <div className="h-28 bg-muted/20 relative overflow-hidden flex-shrink-0">
      {currentImage ? (
        <>
          <img 
            src={currentImage}
            alt="Preview"
            className={`w-full h-full object-cover transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Image className="w-10 h-10 text-muted-foreground/20" />
        </div>
      )}
      
      {/* Variation indicator dots */}
      {hasMultiple && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {messages.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                idx === currentIndex ? 'bg-primary w-3' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  const { campaigns, fetchCampaigns, startCampaign, duplicateCampaign, copyGroupsFromCampaign, replaceGroupsFromCampaign, pauseCampaign, resumeCampaign, deleteCampaign, loading } = useCampaignsStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [paginatedCampaigns, setPaginatedCampaigns] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const limit = 12;

  const isAdmin = user?.role === 'admin';

  // Estado para diálogo de copiar grupos
  const [copyGroupsDialogOpen, setCopyGroupsDialogOpen] = useState(false);
  const [copyGroupsMode, setCopyGroupsMode] = useState('add'); // 'add' ou 'replace'
  const [targetCampaign, setTargetCampaign] = useState(null);
  const [sourceCampaignId, setSourceCampaignId] = useState('');
  const [copyLoading, setCopyLoading] = useState(false);

  const fetchPaginatedCampaigns = useCallback(async () => {
    try {
      const response = await api.get(`/campaigns/paginated?page=${page}&limit=${limit}&owner_filter=${ownerFilter}`);
      setPaginatedCampaigns(response.data.campaigns);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  }, [page, ownerFilter]);

  useEffect(() => {
    fetchPaginatedCampaigns();
    fetchCampaigns(); // Also fetch for store
    
    // Refresh every 10 seconds to update timers and status
    const interval = setInterval(fetchPaginatedCampaigns, 10000);
    return () => clearInterval(interval);
  }, [fetchPaginatedCampaigns, fetchCampaigns]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [ownerFilter]);

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

  const openCopyGroupsDialog = (campaign, mode) => {
    setTargetCampaign(campaign);
    setCopyGroupsMode(mode);
    setSourceCampaignId('');
    setCopyGroupsDialogOpen(true);
  };

  const handleCopyGroups = async () => {
    if (!targetCampaign || !sourceCampaignId) {
      toast.error('Selecione a campanha de origem');
      return;
    }

    setCopyLoading(true);
    try {
      let result;
      if (copyGroupsMode === 'replace') {
        result = await replaceGroupsFromCampaign(targetCampaign.id, sourceCampaignId);
        toast.success(`Grupos substituídos! Agora: ${result.new_count} grupos`);
      } else {
        result = await copyGroupsFromCampaign(targetCampaign.id, sourceCampaignId);
        toast.success(`${result.message} - Total: ${result.new_count} grupos`);
      }
      setCopyGroupsDialogOpen(false);
      fetchPaginatedCampaigns();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao copiar grupos');
    } finally {
      setCopyLoading(false);
    }
  };

  // Filtrar campanhas disponíveis para copiar (todas exceto a atual)
  const availableCampaignsForCopy = campaigns.filter(c => c.id !== targetCampaign?.id);

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
  const canEdit = (status) => ['pending', 'paused', 'completed', 'active'].includes(status);
  
  // Verifica se a campanha nunca rodou (para decidir entre Iniciar vs Retomar)
  const neverRan = (campaign) => !campaign.last_run;

  // Image cache for all campaigns
  const [imageCache, setImageCache] = useState({});
  
  const loadImagePreview = useCallback(async (imageId, cacheKey) => {
    if (imageCache[cacheKey] || !imageId) return;
    
    try {
      const response = await api.get(`/images/${imageId}/file`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      setImageCache(prev => ({ ...prev, [cacheKey]: blobUrl }));
    } catch (error) {
      console.error('Error loading image:', error);
    }
  }, [imageCache]);

  // Preload images for all campaigns
  useEffect(() => {
    paginatedCampaigns.forEach(campaign => {
      // Load images for campaigns with multiple messages
      if (campaign.messages && campaign.messages.length > 0) {
        campaign.messages.forEach((msg, idx) => {
          if (msg.image_id) {
            const cacheKey = `${campaign.id}_${idx}`;
            if (!imageCache[cacheKey]) {
              loadImagePreview(msg.image_id, cacheKey);
            }
          }
        });
      } else if (campaign.image_id) {
        // Single message campaign
        const cacheKey = `${campaign.id}_${campaign.image_id}`;
        if (!imageCache[cacheKey]) {
          loadImagePreview(campaign.image_id, cacheKey);
        }
      }
    });
  }, [paginatedCampaigns, loadImagePreview, imageCache]);

  // Get current message text for preview
  const getCurrentMessage = (campaign) => {
    if (campaign.messages && campaign.messages.length > 0) {
      return campaign.messages[0]?.message || '';
    }
    return campaign.message || '';
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
            const hasMultipleVariations = campaign.messages && campaign.messages.length > 1;
            
            return (
              <Card
                key={campaign.id}
                data-testid={`campaign-card-${campaign.id}`}
                className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1} overflow-hidden flex flex-col`}
              >
                {/* Animated Image Preview */}
                <div className="relative">
                  <AnimatedCampaignPreview 
                    campaign={campaign} 
                    imageCache={imageCache}
                    loadImagePreview={loadImagePreview}
                  />
                  {/* Status badge */}
                  <div className="absolute top-2 left-2 z-10">
                    {getStatusBadge(campaign.status)}
                  </div>
                  {/* Timer */}
                  <div className="absolute top-2 right-2 z-10">
                    <CampaignTimer campaign={campaign} />
                  </div>
                  {/* Multiple variations badge */}
                  {hasMultipleVariations && (
                    <div className="absolute bottom-10 right-2 z-10">
                      <span className="text-[10px] bg-purple-500/80 text-white px-1.5 py-0.5 rounded font-medium">
                        {campaign.messages.length} variações
                      </span>
                    </div>
                  )}
                </div>

                <CardContent className="p-4 flex flex-col flex-1">
                  {/* Title */}
                  <h3 className="font-semibold text-foreground truncate mb-1">{campaign.title}</h3>

                  {/* Message Preview */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1 min-h-[2.5rem]">
                    {getCurrentMessage(campaign) || <span className="italic">Sem mensagem de texto</span>}
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
                        onClick={() => {
                          // Se nunca rodou ou está pendente, usar Start (executa agora)
                          // Se já rodou antes e está pausada, usar Resume (continua de onde parou)
                          if (neverRan(campaign) || campaign.status === 'pending') {
                            handleStart(campaign);
                          } else {
                            handleResume(campaign);
                          }
                        }}
                        disabled={actionLoading === campaign.id}
                        size="sm"
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 h-8"
                      >
                        <Zap className="w-3.5 h-3.5 mr-1" />
                        {neverRan(campaign) || campaign.status === 'pending' ? 'Iniciar' : 'Retomar'}
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

                    {/* Menu de Ações (Duplicar, Copiar Grupos, etc) */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="border-border h-8 w-8"
                          disabled={actionLoading === campaign.id}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => handleDuplicate(campaign)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicar Campanha
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openCopyGroupsDialog(campaign, 'add')}>
                          <FolderInput className="w-4 h-4 mr-2" />
                          Adicionar Grupos de Outra
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openCopyGroupsDialog(campaign, 'replace')}>
                          <Replace className="w-4 h-4 mr-2" />
                          Substituir Grupos
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

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

      {/* Copy Groups Dialog */}
      <Dialog open={copyGroupsDialogOpen} onOpenChange={setCopyGroupsDialogOpen}>
        <DialogContent className="glass-card border-border mx-4 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {copyGroupsMode === 'replace' ? (
                <>
                  <Replace className="w-5 h-5 text-primary" />
                  Substituir Grupos
                </>
              ) : (
                <>
                  <FolderInput className="w-5 h-5 text-primary" />
                  Adicionar Grupos
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {copyGroupsMode === 'replace' 
                ? `Substitua todos os grupos de "${targetCampaign?.title}" pelos grupos de outra campanha.`
                : `Adicione os grupos de outra campanha em "${targetCampaign?.title}".`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Copiar grupos de:
              </label>
              <Select value={sourceCampaignId} onValueChange={setSourceCampaignId}>
                <SelectTrigger className="w-full bg-muted/50 border-border">
                  <SelectValue placeholder="Selecione uma campanha" />
                </SelectTrigger>
                <SelectContent>
                  {availableCampaignsForCopy.map((camp) => (
                    <SelectItem key={camp.id} value={camp.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{camp.title}</span>
                        <span className="text-xs text-muted-foreground">
                          ({camp.total_count || camp.group_ids?.length || 0} grupos)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {targetCampaign && (
              <div className="p-3 bg-muted/30 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{targetCampaign.title}</strong> atualmente tem{' '}
                  <strong className="text-primary">
                    {targetCampaign.total_count || targetCampaign.group_ids?.length || 0}
                  </strong>{' '}
                  grupos configurados.
                </p>
                {copyGroupsMode === 'replace' && (
                  <p className="text-destructive text-xs mt-1">
                    ⚠️ Todos os grupos atuais serão removidos e substituídos.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCopyGroupsDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCopyGroups}
                disabled={!sourceCampaignId || copyLoading}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {copyLoading ? (
                  'Copiando...'
                ) : copyGroupsMode === 'replace' ? (
                  'Substituir Grupos'
                ) : (
                  'Adicionar Grupos'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-border mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deletar Campanha</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar &ldquo;{campaignToDelete?.title}&rdquo;?
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
