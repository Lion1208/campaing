import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageSquare, Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [linkInfo, setLinkInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    validateLink();
  }, [inviteCode]);

  const validateLink = async () => {
    try {
      const response = await api.get(`/invite-links/validate/${inviteCode}`);
      setLinkInfo(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Link inválido ou expirado');
    } finally {
      setValidating(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!username.trim() || !password || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (password.length < 4) {
      toast.error('A senha deve ter pelo menos 4 caracteres');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/auth/register/${inviteCode}`, {
        username: username.trim(),
        password: password,
      });
      toast.success('Conta criada! Aguarde a liberação do administrador.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center neon-glow">
            <MessageSquare className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-heading font-bold text-3xl text-foreground">NEXUZAP</h1>
          <p className="text-primary font-mono text-sm mt-1">CAMPANHAS WHATSAPP</p>
        </div>

        {/* Card */}
        <Card className="glass-card animate-fade-in">
          <CardContent className="p-6">
            {error ? (
              <div className="text-center py-8">
                <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-bold text-foreground mb-2">Link Inválido</h2>
                <p className="text-muted-foreground mb-6">{error}</p>
                <Button onClick={() => navigate('/login')} variant="outline">
                  Voltar para Login
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-foreground">Criar Conta</h2>
                  {linkInfo && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Período de teste: {linkInfo.test_hours}h após liberação
                    </p>
                  )}
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuário</Label>
                    <Input
                      id="username"
                      placeholder="Digite seu usuário"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Digite sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirme sua senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-xs text-yellow-600">
                      ⚠️ Após criar sua conta, aguarde a liberação pelo administrador para acessar o sistema.
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Criar Conta
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-sm text-muted-foreground hover:text-primary"
                  >
                    Já tem conta? Entrar
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Sistema de Campanhas WhatsApp
        </p>
      </div>
    </div>
  );
}
