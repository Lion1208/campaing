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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Wifi, Calendar, Users, Send, TrendingUp, Zap, Sparkles, ChevronDown, AlertCircle, XCircle } from 'lucide-react';
import { api } from '@/store';

// Elegant Particle Animation - Clean and Professional
function ParticleBackground() {
  const canvasRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    if (!isReady) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId;
    let particles = [];
    let mouseX = -1000;
    let mouseY = -1000;
    let isRunning = true;
    
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      createParticles(rect.width, rect.height);
    };
    
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    
    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };
    
    const createParticles = (width, height) => {
      particles = [];
      const count = 50;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2.5 + 1,
          opacity: Math.random() * 0.5 + 0.2,
          baseOpacity: Math.random() * 0.5 + 0.2,
          pulseSpeed: Math.random() * 0.03 + 0.01,
          pulseOffset: Math.random() * Math.PI * 2,
        });
      }
    };
    
    let time = 0;
    
    const animate = () => {
      if (!isRunning) return;
      
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      time += 0.016;
      ctx.clearRect(0, 0, width, height);
      
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 100) {
            const lineOpacity = (1 - dist / 100) * 0.12;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(34, 197, 94, ${lineOpacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      
      // Update and draw particles
      particles.forEach((p) => {
        // Mouse repulsion
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 100 && dist > 0) {
          const force = (100 - dist) / 100 * 0.5;
          p.vx -= (dx / dist) * force * 0.05;
          p.vy -= (dy / dist) * force * 0.05;
        }
        
        // Damping and drift
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.vx += (Math.random() - 0.5) * 0.02;
        p.vy += (Math.random() - 0.5) * 0.02;
        
        p.x += p.vx;
        p.y += p.vy;
        
        // Wrap edges
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        
        // Pulse opacity
        p.opacity = p.baseOpacity + Math.sin(time * p.pulseSpeed * 60 + p.pulseOffset) * 0.15;
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 197, 94, ${p.opacity})`;
        ctx.fill();
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    animate();
    
    return () => {
      isRunning = false;
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isReady]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full"
      style={{ background: 'transparent', pointerEvents: 'auto' }}
    />
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
      {/* Hero Section with Particle Background */}
      <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-card via-card to-primary/5">
        {/* Particle Animation Layer */}
        <div className="absolute inset-0 z-0">
          <ParticleBackground />
        </div>
        
        {/* Content Layer */}
        <CardContent className="relative z-10 p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-primary" />
                <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Dashboard</h1>
              </div>
              <p className="text-muted-foreground text-sm">
                Olá, <span className="text-primary font-semibold">{user?.username}</span>! Aqui está seu resumo.
              </p>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32 bg-background/80 backdrop-blur-sm border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Dispositivos */}
            <div className="bg-background/70 backdrop-blur-sm rounded-xl p-4 border border-border/30 transition-all hover:border-primary/30 hover:bg-background/90">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Wifi className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="font-heading font-bold text-2xl sm:text-3xl text-foreground">
                {connectedCount}<span className="text-base sm:text-lg text-muted-foreground">/{connections.length}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Dispositivos</p>
            </div>

            {/* Campanhas Ativas */}
            <div className="bg-background/70 backdrop-blur-sm rounded-xl p-4 border border-border/30 transition-all hover:border-blue-500/30 hover:bg-background/90">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <p className="font-heading font-bold text-2xl sm:text-3xl text-foreground">
                {activeCampaigns}<span className="text-base sm:text-lg text-muted-foreground">/{campaigns.length}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Campanhas</p>
            </div>

            {/* Revendedores / Envios */}
            {(user?.role === 'admin' || user?.role === 'master') ? (
              <div className="bg-background/70 backdrop-blur-sm rounded-xl p-4 border border-border/30 transition-all hover:border-purple-500/30 hover:bg-background/90">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Users className="w-4 h-4 text-purple-500" />
                  </div>
                </div>
                <p className="font-heading font-bold text-2xl sm:text-3xl text-foreground">
                  {stats?.resellers_count || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Revendedores</p>
              </div>
            ) : (
              <div className="bg-background/70 backdrop-blur-sm rounded-xl p-4 border border-border/30 transition-all hover:border-yellow-500/30 hover:bg-background/90">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-yellow-500/15 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-yellow-500" />
                  </div>
                </div>
                <p className="font-heading font-bold text-2xl sm:text-3xl text-foreground">
                  {stats?.sends_period || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Envios ({period}d)</p>
              </div>
            )}

            {/* Envios Hoje */}
            <div className="bg-background/70 backdrop-blur-sm rounded-xl p-4 border border-border/30 transition-all hover:border-green-500/30 hover:bg-background/90">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center">
                  <Send className="w-4 h-4 text-green-500" />
                </div>
              </div>
              <p className="font-heading font-bold text-2xl sm:text-3xl text-foreground">
                {stats?.sends_today || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Envios Hoje</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <Card className="glass-card">
          <CardContent className="p-4">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <div className="cursor-pointer">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-foreground">Taxa de Sucesso</span>
                      {stats?.total_failed > 0 && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="w-3 h-3" />
                          {stats.total_failed} erro{stats.total_failed > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-green-500">{stats?.success_rate || 100}%</span>
                      {stats?.recent_errors?.length > 0 && (
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${stats?.success_rate || 100}%` }}
                    />
                  </div>
                </div>
              </CollapsibleTrigger>
              
              {stats?.recent_errors?.length > 0 && (
                <CollapsibleContent>
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium mb-2">Últimos erros:</p>
                    {stats.recent_errors.map((error, idx) => (
                      <div 
                        key={error.id || idx} 
                        className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10"
                      >
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-foreground truncate">
                              {error.group_name}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">
                              {new Date(error.sent_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-[10px] text-destructive truncate mt-0.5">
                            {error.error}
                          </p>
                          {error.campaign_name && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Campanha: {error.campaign_name}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              )}
            </Collapsible>
          </CardContent>
        </Card>

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
