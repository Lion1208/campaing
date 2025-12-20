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

// Pure Particle Animation
function ParticleBackground() {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let animationId;
    let particles = [];
    let mouseX = 0;
    let mouseY = 0;
    
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    
    resize();
    window.addEventListener('resize', resize);
    
    // Mouse tracking for interactivity
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    
    // Create particles
    const createParticles = () => {
      particles = [];
      const count = 80;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.offsetWidth,
          y: Math.random() * canvas.offsetHeight,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          size: Math.random() * 2.5 + 0.5,
          opacity: Math.random() * 0.6 + 0.2,
          hue: 140 + Math.random() * 20, // Green hues
        });
      }
    };
    
    createParticles();
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      
      particles.forEach((p, i) => {
        // Mouse attraction
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const force = (150 - dist) / 150 * 0.02;
          p.vx += dx * force * 0.01;
          p.vy += dy * force * 0.01;
        }
        
        // Apply velocity with damping
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        
        // Wrap around edges
        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y < 0) p.y = canvas.offsetHeight;
        if (p.y > canvas.offsetHeight) p.y = 0;
        
        // Draw particle with glow
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        gradient.addColorStop(0, `hsla(${p.hue}, 80%, 55%, ${p.opacity})`);
        gradient.addColorStop(1, `hsla(${p.hue}, 80%, 55%, 0)`);
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Core particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${p.opacity + 0.2})`;
        ctx.fill();
        
        // Draw connections
        particles.slice(i + 1).forEach(p2 => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const lineOpacity = (1 - dist / 120) * 0.15;
            ctx.strokeStyle = `hsla(150, 70%, 50%, ${lineOpacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full"
      style={{ background: 'transparent' }}
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
      {/* Hero Section - Single Card with Particle Background */}
      <Card className="relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur">
        <ParticleBackground />
        <CardContent className="relative z-10 p-6">
          {/* Header inside card */}
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
              <SelectTrigger className="w-32 bg-background/70 backdrop-blur border-border text-foreground">
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
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50 hover:border-primary/50 transition-all hover:scale-[1.02] hover:bg-background/80">
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
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50 hover:border-blue-500/50 transition-all hover:scale-[1.02] hover:bg-background/80">
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
              <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50 hover:border-purple-500/50 transition-all hover:scale-[1.02] hover:bg-background/80">
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
              <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50 hover:border-yellow-500/50 transition-all hover:scale-[1.02] hover:bg-background/80">
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
            <div className="bg-background/60 backdrop-blur-sm rounded-xl p-4 border border-border/50 hover:border-green-500/50 transition-all hover:scale-[1.02] hover:bg-background/80">
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
