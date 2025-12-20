import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, api } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageSquare, Eye, EyeOff, LogIn, UserPlus, X } from 'lucide-react';

const SAVED_USER_KEY = 'nexuzap_saved_user';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedUser, setSavedUser] = useState(null);
  const passwordRef = useRef(null);

  // Carrega usuário salvo ao montar
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_USER_KEY);
    if (saved) {
      setSavedUser(saved);
      setUsername(saved);
    }
  }, []);

  // Foca no campo de senha se já tem usuário salvo
  useEffect(() => {
    if (savedUser && !isRegister && passwordRef.current) {
      passwordRef.current.focus();
    }
  }, [savedUser, isRegister]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
      // Salva o usuário no localStorage após login bem sucedido
      localStorage.setItem(SAVED_USER_KEY, username.trim());
      setSavedUser(username.trim());
      toast.success('Login realizado!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao fazer login');
    } finally {
      setLoading(false);
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
      await api.post('/auth/register', {
        username: username.trim(),
        password: password,
      });
      toast.success('Conta criada! Aguarde a aprovação do administrador.');
      setIsRegister(false);
      setPassword('');
      setConfirmPassword('');
      setUsername('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const clearSavedUser = () => {
    localStorage.removeItem(SAVED_USER_KEY);
    setSavedUser(null);
    setUsername('');
    setPassword('');
  };

  const switchUser = () => {
    setUsername('');
    setPassword('');
  };

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
            <div className="flex mb-6">
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                className={`flex-1 pb-2 text-sm font-medium transition-all border-b-2 ${
                  !isRegister 
                    ? 'text-primary border-primary' 
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                className={`flex-1 pb-2 text-sm font-medium transition-all border-b-2 ${
                  isRegister 
                    ? 'text-primary border-primary' 
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                Cadastrar
              </button>
            </div>

            <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
              {/* Usuário salvo ou campo de input */}
              {!isRegister && savedUser && username === savedUser ? (
                <div className="space-y-2">
                  <Label className="text-foreground">Usuário</Label>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-md">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-semibold text-sm uppercase">
                        {savedUser.charAt(0)}
                      </span>
                    </div>
                    <span className="text-foreground font-medium flex-1 truncate">{savedUser}</span>
                    <button
                      type="button"
                      onClick={switchUser}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Trocar
                    </button>
                    <button
                      type="button"
                      onClick={clearSavedUser}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Remover usuário salvo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-foreground">Usuário</Label>
                  <Input
                    data-testid="username-input"
                    placeholder="Digite seu usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                    autoComplete="username"
                    autoFocus={!savedUser}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-foreground">Senha</Label>
                <div className="relative">
                  <Input
                    ref={passwordRef}
                    data-testid="password-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground pr-12"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    autoFocus={!isRegister && savedUser && username === savedUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isRegister && (
                <div className="space-y-2">
                  <Label className="text-foreground">Confirmar Senha</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirme sua senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground pr-12"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button
                data-testid="login-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    {isRegister ? 'Criando conta...' : 'Entrando...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {isRegister ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                    {isRegister ? 'Criar Conta' : 'Entrar'}
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center">
                {isRegister 
                  ? 'Ao se cadastrar, sua conta ficará aguardando aprovação do administrador.'
                  : 'Sistema de Campanhas WhatsApp'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
