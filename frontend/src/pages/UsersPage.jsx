import { useEffect, useState } from 'react';
import { useAdminStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Plus, Users, Wifi, Send, Edit2, Trash2 } from 'lucide-react';

export default function UsersPage() {
  const { users, fetchUsers, createUser, updateUser, deleteUser, stats, fetchAdminStats, loading } = useAdminStore();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', max_connections: 1 });
  const [editData, setEditData] = useState({ max_connections: 1, active: true });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchAdminStats();
  }, [fetchUsers, fetchAdminStats]);

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setActionLoading(true);
    try {
      await createUser({
        username: newUser.username.trim(),
        password: newUser.password,
        max_connections: newUser.max_connections,
      });
      toast.success('Revendedor criado!');
      setCreateDialogOpen(false);
      setNewUser({ username: '', password: '', max_connections: 1 });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      await updateUser(selectedUser.id, editData);
      toast.success('Revendedor atualizado');
      setEditDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      await deleteUser(selectedUser.id);
      toast.success('Revendedor deletado');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao deletar');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setEditData({ max_connections: user.max_connections, active: user.active });
    setEditDialogOpen(true);
  };

  const statCards = [
    { label: 'Total Revendedores', value: stats?.total_users || 0, icon: Users },
    { label: 'Ativos', value: stats?.active_users || 0, icon: Users, color: 'text-primary' },
    { label: 'Conexões', value: stats?.total_connections || 0, icon: Wifi },
    { label: 'Campanhas', value: stats?.total_campaigns || 0, icon: Send },
  ];

  return (
    <div data-testid="users-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Revendedores</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os revendedores do sistema</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-user-btn" className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow">
              <Plus className="w-4 h-4 mr-2" />
              Novo Revendedor
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10 mx-4 max-w-sm">
            <DialogHeader>
              <DialogTitle>Novo Revendedor</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Adicione um novo revendedor ao sistema
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input
                  data-testid="new-user-username"
                  placeholder="Nome de usuário"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input
                  data-testid="new-user-password"
                  type="password"
                  placeholder="Senha"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Máximo de Conexões</Label>
                <Input
                  data-testid="new-user-connections"
                  type="number"
                  min={1}
                  max={100}
                  value={newUser.max_connections}
                  onChange={(e) => setNewUser({ ...newUser, max_connections: parseInt(e.target.value) || 1 })}
                  className="bg-background/50"
                />
              </div>
              <Button
                data-testid="confirm-create-user"
                onClick={handleCreate}
                disabled={actionLoading}
                className="w-full bg-primary text-primary-foreground"
              >
                {actionLoading ? 'Criando...' : 'Criar Revendedor'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className={`glass-card animate-fade-in stagger-${index + 1}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className={`font-heading font-bold text-2xl ${stat.color || ''}`}>{stat.value}</p>
                </div>
                <Icon className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg mb-2">Nenhum revendedor</h3>
            <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro revendedor</p>
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary text-primary-foreground">
              Criar Revendedor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((user, index) => (
            <Card
              key={user.id}
              data-testid={`user-row-${user.id}`}
              className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <span className="font-heading font-bold text-primary uppercase">{user.username[0]}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-foreground truncate">{user.username}</p>
                        <Badge variant="outline" className={user.active ? 'status-connected' : 'status-disconnected'}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Máx. {user.max_connections} conexões • Criado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      data-testid={`edit-user-${user.id}`}
                      variant="outline"
                      size="icon"
                      onClick={() => openEditDialog(user)}
                      className="border-white/10 h-8 w-8"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      data-testid={`delete-user-${user.id}`}
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectedUser(user);
                        setDeleteDialogOpen(true);
                      }}
                      className="border-destructive/20 text-destructive hover:bg-destructive/10 h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass-card border-white/10 mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Revendedor</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Atualize as configurações de {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Máximo de Conexões</Label>
              <Input
                data-testid="edit-user-connections"
                type="number"
                min={1}
                max={100}
                value={editData.max_connections}
                onChange={(e) => setEditData({ ...editData, max_connections: parseInt(e.target.value) || 1 })}
                className="bg-background/50"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-background/30 rounded-lg">
              <div>
                <Label>Status</Label>
                <p className="text-sm text-muted-foreground">{editData.active ? 'Ativo' : 'Inativo'}</p>
              </div>
              <Switch
                data-testid="edit-user-active"
                checked={editData.active}
                onCheckedChange={(checked) => setEditData({ ...editData, active: checked })}
              />
            </div>
            <Button
              data-testid="confirm-edit-user"
              onClick={handleUpdate}
              disabled={actionLoading}
              className="w-full bg-primary text-primary-foreground"
            >
              {actionLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-white/10 mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Revendedor</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar "{selectedUser?.username}"? Todas as conexões e campanhas serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-user"
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
