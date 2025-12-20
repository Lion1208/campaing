import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore, useAuthStore, useConnectionsStore, useCampaignsStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, Clock, CheckCircle, Users, Plus, Send, ArrowRight } from 'lucide-react';

export default function DashboardPage() {
  const { stats, fetchStats, loading } = useDashboardStore();
  const { user } = useAuthStore();
  const { connections, fetchConnections } = useConnectionsStore();
  const { campaigns, fetchCampaigns } = useCampaignsStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
    fetchConnections();
    fetchCampaigns();
  }, [fetchStats, fetchConnections, fetchCampaigns]);

  const statCards = [
    {
      title: 'Conexões Ativas',
      value: stats?.active_connections || 0,
      total: stats?.total_connections || 0,
      icon: Wifi,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Campanhas Ativas',
      value: stats?.pending_campaigns || 0,
      total: stats?.total_campaigns || 0,
      icon: Clock,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    {
      title: 'Concluídas',
      value: stats?.completed_campaigns || 0,
      icon: CheckCircle,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Grupos',
      value: stats?.total_groups || 0,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
  ];

  const getStatusBadge = (status) => {
    const config = {
      connected: { class: 'status-connected', label: 'Conectado' },
      connecting: { class: 'status-connecting', label: 'Conectando' },
      disconnected: { class: 'status-disconnected', label: 'Desconectado' },
      pending: { class: 'status-pending', label: 'Pendente' },
      running: { class: 'status-running', label: 'Enviando' },
      completed: { class: 'status-completed', label: 'Concluída' },
      failed: { class: 'status-failed', label: 'Falhou' },
      active: { class: 'status-active', label: 'Ativa' },
      paused: { class: 'status-paused', label: 'Pausada' },
    };
    const c = config[status] || { class: 'status-disconnected', label: status };
    return (
      <Badge variant="outline" className={`${c.class} text-[10px] uppercase tracking-wider px-2`}>
        {c.label}
      </Badge>
    );
  };

  return (
    <div data-testid="dashboard-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Painel</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Olá, <span className="text-primary font-medium">{user?.username}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate('/connections')}
            variant="outline"
            size="sm"
            className="border-white/10 hover:bg-white/5"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Nova </span>Conexão
          </Button>
          <Button
            onClick={() => navigate('/campaigns/new')}
            data-testid="new-campaign-btn"
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Nova </span>Campanha
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className={`glass-card animate-fade-in stagger-${index + 1}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1 truncate">
                      {stat.title}
                    </p>
                    <p className="font-heading font-bold text-2xl md:text-3xl text-foreground">
                      {loading ? '-' : stat.value}
                    </p>
                    {stat.total !== undefined && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        de {stat.total} total
                      </p>
                    )}
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Connections */}
        <Card className="glass-card">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-heading font-semibold">Conexões</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/connections')}
              className="text-primary hover:text-primary/80 -mr-2"
            >
              Ver todas
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="p-0">
            {connections.length === 0 ? (
              <div className="p-8 text-center">
                <Wifi className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">Nenhuma conexão</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/connections')}
                >
                  Criar conexão
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {connections.slice(0, 4).map((conn) => (
                  <div key={conn.id} className="p-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          conn.status === 'connected' ? 'bg-primary/15' : 'bg-white/5'
                        }`}>
                          <Wifi className={`w-4 h-4 ${conn.status === 'connected' ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{conn.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {conn.phone_number || 'Não conectado'}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(conn.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Campaigns */}
        <Card className="glass-card">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-heading font-semibold">Campanhas Recentes</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/campaigns')}
              className="text-primary hover:text-primary/80 -mr-2"
            >
              Ver todas
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="p-0">
            {campaigns.length === 0 ? (
              <div className="p-8 text-center">
                <Send className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm mb-3">Nenhuma campanha</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/campaigns/new')}
                >
                  Criar campanha
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {campaigns.slice(0, 4).map((campaign) => (
                  <div key={campaign.id} className="p-3 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">{campaign.title}</p>
                          {getStatusBadge(campaign.status)}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{campaign.sent_count}/{campaign.total_count} grupos</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">
                            {campaign.schedule_type === 'once' ? 'Único' : 
                             campaign.schedule_type === 'interval' ? `A cada ${campaign.interval_hours}h` : 
                             'Horários'}
                          </span>
                        </div>
                      </div>
                      <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden flex-shrink-0">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(campaign.sent_count / campaign.total_count) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Messages Counter */}
      <Card className="glass-card">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
              Total de Mensagens Enviadas
            </p>
            <p className="font-heading font-black text-4xl md:text-5xl text-primary">
              {stats?.total_messages_sent?.toLocaleString('pt-BR') || 0}
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Send className="w-8 h-8 text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
