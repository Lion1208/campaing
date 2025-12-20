import { useState } from 'react';
import { useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, Lock, Eye, EyeOff, Save, Shield, Calendar, Coins } from 'lucide-react';
import { api } from '@/store';

export default function ProfilePage() {
  const { user, checkAuth } = useAuthStore();
  const [username, setUsername] = useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error('Nome de usuário é obrigatório');
      return;
    }

    setLoadingProfile(true);
    try {
      await api.put('/auth/profile', { username: username.trim() });
      await checkAuth();
      toast.success('Perfil atualizado!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar perfil');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (newPassword.length < 4) {
      toast.error('A nova senha deve ter pelo menos 4 caracteres');
      return;
    }

    setLoadingPassword(true);
    try {
      await api.put('/auth/password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao alterar senha');
    } finally {
      setLoadingPassword(false);
    }
  };

  const getRoleBadge = (role) => {
    const config = {
      admin: { class: 'status-connected', label: 'Administrador', icon: Shield },
      master: { class: 'status-active', label: 'Master', icon: Shield },
      reseller: { class: 'status-pending', label: 'Revendedor', icon: User }
    };
    const c = config[role] || config.reseller;
    const Icon = c.icon;
    return (
      <Badge variant="outline" className={`${c.class} gap-1`}>
        <Icon className="w-3 h-3" />
        {c.label}
      </Badge>
    );
  };

  return (
    <div data-testid="profile-page" className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie suas informações pessoais</p>
      </div>

      {/* User Info Card */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="font-heading font-bold text-2xl text-primary uppercase">
                {user?.username?.[0] || 'U'}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="font-heading font-bold text-xl text-foreground">{user?.username}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {getRoleBadge(user?.role)}
                {(user?.role === 'master' || user?.role === 'admin') && (
                  <Badge variant="outline" className="status-pending gap-1">
                    <Coins className="w-3 h-3" />
                    {user?.role === 'admin' ? '∞ créditos' : `${user?.credits || 0} créditos`}
                  </Badge>
                )}
              </div>
              {user?.expires_at && user?.role !== 'admin' && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Expira em: {new Date(user.expires_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Update Username */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-lg text-foreground">Alterar Nome de Usuário</h3>
          </div>
          
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Nome de Usuário</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Seu nome de usuário"
                className="bg-muted/50 border-border text-foreground"
              />
            </div>
            <Button
              type="submit"
              disabled={loadingProfile}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loadingProfile ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-lg text-foreground">Alterar Senha</h3>
          </div>
          
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Senha Atual</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  className="bg-muted/50 border-border text-foreground pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  className="bg-muted/50 border-border text-foreground pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  className="bg-muted/50 border-border text-foreground pr-12"
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

            <Button
              type="submit"
              disabled={loadingPassword}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loadingPassword ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Alterando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Alterar Senha
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
