import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useConnectionsStore, useCampaignsStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wifi, Calendar, Users, Send, TrendingUp, Zap, Sparkles } from 'lucide-react';
import { api } from '@/store';

// Animated Gradient Background
function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl">
      {/* Gradient orbs */}
      <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-primary/30 via-transparent to-transparent animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-emerald-500/20 via-transparent to-transparent animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-gradient-radial from-cyan-500/10 via-transparent to-transparent animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
      
      {/* Floating particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/40 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>
      
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
      }} />
    </div>
  );
}

// Mini Chart Component
function MiniChart({ data, color = '#22c55e' }) {
  const maxValue = Math.max(...data, 1);
  const height = 60;
  
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((value, index) => (
        <div
          key={index}
          className="flex-1 rounded-t transition-all duration-300 hover:opacity-80"
          style={{
            height: `${(value / maxValue) * height}px`,
            background: `linear-gradient(to top, ${color}40, ${color})`,
            minHeight: value > 0 ? '4px' : '2px',
          }}
          title={`${value} envios`}
        />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { connections, fetchConnections } = useConnectionsStore();
  const { campaigns, fetchCampaigns } = useCampaignsStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7');

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get(`/stats/dashboard?days=${period}`);
      setStats(response.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchConnections();
    fetchCampaigns();
    fetchStats();
  }, [fetchConnections, fetchCampaigns, fetchStats]);

  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const activeCampaigns = campaigns.filter(c => ['active', 'running'].includes(c.status)).length;

  return (
    <div data-testid="dashboard-page" className="space-y-6 animate-fade-in">
      {/* Hero Section - Single Card with Animated Background */}
      <Card className="relative overflow-hidden border-primary/20">
        <AnimatedBackground />
        <CardContent className="relative z-10 p-6">
          {/* Header inside card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Dashboard</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Olá, <span className="text-primary font-semibold">{user?.username}</span>! Aqui está seu resumo.
              </p>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 bg-background/50 backdrop-blur border-primary/30 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Dispositivos */}
            <div className="bg-background/40 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-primary/30 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Conectados</span>
              </div>
              <p className="font-heading font-bold text-3xl text-foreground">
                {connectedCount}<span className="text-lg text-muted-foreground">/{connections.length}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Dispositivos</p>
            </div>

            {/* Campanhas Ativas */}
            <div className="bg-background/40 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-blue-500/30 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Ativas</span>
              </div>
              <p className="font-heading font-bold text-3xl text-foreground">
                {activeCampaigns}<span className="text-lg text-muted-foreground">/{campaigns.length}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Campanhas</p>
            </div>

            {/* Revendedores */}
            {(user?.role === 'admin' || user?.role === 'master') ? (
              <div className="bg-background/40 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-purple-500/30 transition-all hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-500" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total</span>
                </div>
                <p className="font-heading font-bold text-3xl text-foreground">
                  {stats?.resellers_count || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Revendedores</p>
              </div>
            ) : (
              <div className="bg-background/40 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-yellow-500/30 transition-all hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-yellow-500" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Período</span>
                </div>
                <p className="font-heading font-bold text-3xl text-foreground">
                  {stats?.sends_period || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Envios</p>
              </div>
            )}

            {/* Envios Hoje */}
            <div className="bg-background/40 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-green-500/30 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-green-500" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Hoje</span>
              </div>
              <p className="font-heading font-bold text-3xl text-foreground">
                {stats?.sends_today || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Envios</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Envios do Período */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-foreground">Envios ({period} dias)</span>
              </div>
              <span className="text-2xl font-bold text-primary">{stats?.sends_period || 0}</span>
            </div>
            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (stats?.sends_period || 0) / 10)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Sucesso */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-foreground">Taxa de Sucesso</span>
              </div>
              <span className="text-2xl font-bold text-green-500">{stats?.success_rate || 100}%</span>
            </div>
            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                style={{ width: `${stats?.success_rate || 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Campanhas Concluídas */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-foreground">Concluídas</span>
              </div>
              <span className="text-2xl font-bold text-blue-500">
                {campaigns.filter(c => c.status === 'completed').length}
              </span>
            </div>
            <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all"
                style={{ 
                  width: campaigns.length > 0 
                    ? `${(campaigns.filter(c => c.status === 'completed').length / campaigns.length) * 100}%` 
                    : '0%' 
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold text-foreground">Envios por Dia</h3>
            <span className="text-xs text-muted-foreground">Últimos {period} dias</span>
          </div>
          
          {loading ? (
            <div className="h-20 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <MiniChart data={stats?.daily_sends || Array(parseInt(period)).fill(0)} />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>{period === '7' ? '7 dias atrás' : '30 dias atrás'}</span>
                <span>Hoje</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <h3 className="font-heading font-semibold text-foreground mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2 border-border hover:border-primary hover:bg-primary/5"
              onClick={() => navigate('/connections')}
            >
              <Wifi className="w-5 h-5 text-primary" />
              <span className="text-xs">Nova Conexão</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2 border-border hover:border-primary hover:bg-primary/5"
              onClick={() => navigate('/campaigns/new')}
            >
              <Calendar className="w-5 h-5 text-primary" />
              <span className="text-xs">Nova Campanha</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2 border-border hover:border-primary hover:bg-primary/5"
              onClick={() => navigate('/templates')}
            >
              <Send className="w-5 h-5 text-primary" />
              <span className="text-xs">Templates</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col gap-2 border-border hover:border-primary hover:bg-primary/5"
              onClick={() => navigate('/history')}
            >
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-xs">Histórico</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
