import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      toast.success('Login realizado com sucesso!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-bg flex">
      {/* Left Panel - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: 'url(https://images.unsplash.com/photo-1760344594784-60ff14035eb0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwyfHxmdXR1cmlzdGljJTIwYWJzdHJhY3QlMjBncmVlbiUyMGRpZ2l0YWwlMjBkYXRhJTIwZmxvd3xlbnwwfHx8fDE3NjYyNTg0Nzl8MA&ixlib=rb-4.1.0&q=85)'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative z-10 flex flex-col justify-center p-12">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center neon-glow-strong">
                <svg className="w-8 h-8 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h1 className="font-heading font-black text-4xl text-foreground tracking-tight">NEXUS</h1>
                <p className="text-sm font-mono text-primary uppercase tracking-widest">WhatsApp Command</p>
              </div>
            </div>
            <h2 className="font-heading font-bold text-2xl text-foreground mb-4">
              Centro de Comando de Campanhas
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Gerencie suas campanhas de WhatsApp com precisão. Conecte múltiplos números, 
              selecione grupos e agende disparos automatizados.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center neon-glow">
              <svg className="w-7 h-7 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h1 className="font-heading font-black text-2xl text-foreground">NEXUS</h1>
              <p className="text-xs font-mono text-primary uppercase tracking-widest">WhatsApp</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-8 animate-fade-in">
            <div className="mb-8">
              <h2 className="font-heading font-bold text-2xl text-foreground mb-2">Entrar</h2>
              <p className="text-muted-foreground text-sm">Acesse sua conta para gerenciar campanhas</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Usuário
                </Label>
                <Input
                  id="username"
                  data-testid="login-username"
                  type="text"
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 bg-black/40 border-white/10 focus:border-primary/50 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Senha
                </Label>
                <Input
                  id="password"
                  data-testid="login-password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-black/40 border-white/10 focus:border-primary/50 font-mono"
                />
              </div>

              <Button
                type="submit"
                data-testid="login-submit"
                disabled={loading}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 btn-glow font-bold tracking-wide uppercase text-xs"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Entrando...
                  </span>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/5">
              <p className="text-xs text-muted-foreground text-center font-mono">
                Credenciais padrão: <span className="text-primary">admin</span> / <span className="text-primary">admin123</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
