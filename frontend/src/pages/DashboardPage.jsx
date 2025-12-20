import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore, useAuthStore, useConnectionsStore, useCampaignsStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
      icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0',
      color: 'text-primary',
    },
    {
      title: 'Campanhas Pendentes',
      value: stats?.pending_campaigns || 0,
      total: stats?.total_campaigns || 0,
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'text-yellow-500',
    },
    {
      title: 'Campanhas Enviadas',
      value: stats?.completed_campaigns || 0,
      total: stats?.total_campaigns || 0,
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'text-primary',
    },
    {
      title: 'Total de Grupos',
      value: stats?.total_groups || 0,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'text-blue-400',
    },
  ];

  const getStatusBadge = (status) => {
    const styles = {
      connected: 'status-connected',
      connecting: 'status-connecting',
      disconnected: 'status-disconnected',
      pending: 'status-pending',
      running: 'status-running',
      completed: 'status-completed',
      failed: 'status-failed',
    };
    const labels = {
      connected: 'Conectado',
      connecting: 'Conectando',
      disconnected: 'Desconectado',
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

  return (
    <div data-testid="dashboard-page" className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo, <span className="text-primary font-medium">{user?.username}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => navigate('/connections')}
            data-testid="new-connection-btn"
            variant="outline"
            className="border-white/10 hover:bg-white/5"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Conexão
          </Button>
          <Button
            onClick={() => navigate('/campaigns/new')}
            data-testid="new-campaign-btn"
            className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Campanha
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <Card 
            key={stat.title} 
            className={`glass-card hover-lift animate-fade-in stagger-${index + 1}`}
            style={{ opacity: 0 }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    {stat.title}
                  </p>
                  <p className="font-heading font-bold text-4xl text-foreground">
                    {loading ? '-' : stat.value}
                  </p>
                  {stat.total !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      de {stat.total} total
                    </p>
                  )}
                </div>
                <div className={`w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center ${stat.color}`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                  </svg>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Connections */}
        <Card className="glass-card lg:col-span-5">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading font-semibold text-lg">Conexões Recentes</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/connections')}
                className="text-primary hover:text-primary/80"
              >
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {connections.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm">Nenhuma conexão encontrada</p>
                <Button 
                  variant="link" 
                  className="text-primary mt-2"
                  onClick={() => navigate('/connections')}
                >
                  Criar primeira conexão
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {connections.slice(0, 5).map((conn) => (
                  <div key={conn.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          conn.status === 'connected' ? 'bg-primary/10' : 'bg-white/5'
                        }`}>
                          <svg className={`w-5 h-5 ${conn.status === 'connected' ? 'text-primary' : 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{conn.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
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
          </CardContent>
        </Card>

        {/* Campaigns */}
        <Card className="glass-card lg:col-span-7">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading font-semibold text-lg">Campanhas Recentes</CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/campaigns')}
                className="text-primary hover:text-primary/80"
              >
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {campaigns.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm">Nenhuma campanha criada</p>
                <Button 
                  variant="link" 
                  className="text-primary mt-2"
                  onClick={() => navigate('/campaigns/new')}
                >
                  Criar primeira campanha
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {campaigns.slice(0, 5).map((campaign) => (
                  <div key={campaign.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <p className="font-medium text-sm text-foreground truncate">{campaign.title}</p>
                          {getStatusBadge(campaign.status)}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {campaign.sent_count}/{campaign.total_count} grupos
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(campaign.scheduled_time).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden ml-4">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(campaign.sent_count / campaign.total_count) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Messages Sent Counter */}
      <Card className="glass-card">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Total de Mensagens Enviadas
              </p>
              <p className="font-heading font-black text-6xl text-primary neon-glow">
                {stats?.total_messages_sent?.toLocaleString('pt-BR') || 0}
              </p>
            </div>
            <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
              <svg className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
