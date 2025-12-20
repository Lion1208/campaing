import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCampaignsStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function CampaignsPage() {
  const { campaigns, fetchCampaigns, deleteCampaign, loading } = useCampaignsStore();
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

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
    const styles = {
      pending: 'status-pending',
      running: 'status-running',
      completed: 'status-completed',
      failed: 'status-failed',
    };
    const labels = {
      pending: 'Pendente',
      running: 'Enviando',
      completed: 'Concluída',
      failed: 'Falhou',
    };
    return (
      <Badge variant="outline" className={`${styles[status]} font-mono text-[10px] uppercase tracking-wider`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'running':
        return (
          <svg className="w-5 h-5 text-yellow-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div data-testid="campaigns-page" className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-tight">Campanhas</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas campanhas de mensagens
          </p>
        </div>
        <Button
          data-testid="create-campaign-btn"
          onClick={() => navigate('/campaigns/new')}
          className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Campanha
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: campaigns.length, color: 'text-foreground' },
          { label: 'Pendentes', value: campaigns.filter(c => c.status === 'pending').length, color: 'text-blue-400' },
          { label: 'Enviando', value: campaigns.filter(c => c.status === 'running').length, color: 'text-yellow-500' },
          { label: 'Concluídas', value: campaigns.filter(c => c.status === 'completed').length, color: 'text-primary' },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{stat.label}</span>
              <span className={`font-heading font-bold text-2xl ${stat.color}`}>{stat.value}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-primary font-mono">Carregando...</div>
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-heading font-semibold text-xl text-foreground mb-2">
              Nenhuma campanha encontrada
            </h3>
            <p className="text-muted-foreground mb-6">
              Crie sua primeira campanha para começar a enviar mensagens
            </p>
            <Button
              onClick={() => navigate('/campaigns/new')}
              className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
            >
              Criar Primeira Campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign, index) => (
            <Card
              key={campaign.id}
              data-testid={`campaign-card-${campaign.id}`}
              className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1}`}
              style={{ opacity: 0 }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      campaign.status === 'completed' ? 'bg-primary/10' : 
                      campaign.status === 'running' ? 'bg-yellow-500/10' : 
                      campaign.status === 'failed' ? 'bg-destructive/10' : 'bg-blue-500/10'
                    }`}>
                      {getStatusIcon(campaign.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-heading font-semibold text-lg text-foreground truncate">
                          {campaign.title}
                        </h3>
                        {getStatusBadge(campaign.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {campaign.total_count} grupos
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(campaign.scheduled_time).toLocaleString('pt-BR')}
                        </span>
                        {campaign.image_url && (
                          <span className="flex items-center gap-1 text-primary">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Com imagem
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress */}
                    <div className="w-32">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-mono text-foreground">
                          {campaign.sent_count}/{campaign.total_count}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            campaign.status === 'completed' ? 'bg-primary' :
                            campaign.status === 'failed' ? 'bg-destructive' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${(campaign.sent_count / campaign.total_count) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <Button
                      data-testid={`delete-campaign-${campaign.id}`}
                      onClick={() => {
                        setCampaignToDelete(campaign);
                        setDeleteDialogOpen(true);
                      }}
                      variant="outline"
                      size="icon"
                      className="border-destructive/20 text-destructive hover:bg-destructive/10"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                </div>

                {/* Message Preview */}
                {campaign.message && (
                  <div className="mt-4 p-4 bg-black/40 rounded-lg border border-white/5">
                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                      Mensagem
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-2">
                      {campaign.message}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Deletar Campanha</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar a campanha "{campaignToDelete?.title}"? 
              Esta ação não pode ser desfeita.
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
