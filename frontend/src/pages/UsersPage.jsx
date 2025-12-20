import { useEffect, useState } from 'react';
import { useAdminStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

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
      toast.success('Revendedor criado com sucesso!');
      setCreateDialogOpen(false);
      setNewUser({ username: '', password: '', max_connections: 1 });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar revendedor');
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

  return (
    <div data-testid="users-page" className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-tight">Revendedores</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os revendedores do sistema
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="create-user-btn"
              className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Revendedor
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10">
            <DialogHeader>
              <DialogTitle className="font-heading">Criar Revendedor</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Adicione um novo revendedor ao sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Usuário
                </Label>
                <Input
                  data-testid="new-user-username"
                  placeholder="Digite o nome de usuário"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="h-12 bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Senha
                </Label>
                <Input
                  data-testid="new-user-password"
                  type="password"
                  placeholder="Digite a senha"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="h-12 bg-black/40 border-white/10"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Máximo de Conexões
                </Label>
                <Input
                  data-testid="new-user-connections"
                  type="number"
                  min={1}
                  max={100}
                  value={newUser.max_connections}
                  onChange={(e) => setNewUser({ ...newUser, max_connections: parseInt(e.target.value) || 1 })}
                  className="h-12 bg-black/40 border-white/10"
                />
              </div>
              <Button
                data-testid="confirm-create-user"
                onClick={handleCreate}
                disabled={actionLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
              >
                {actionLoading ? 'Criando...' : 'Criar Revendedor'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revendedores', value: stats?.total_users || 0, icon: '👥' },
          { label: 'Ativos', value: stats?.active_users || 0, icon: '✅' },
          { label: 'Total Conexões', value: stats?.total_connections || 0, icon: '🔗' },
          { label: 'Total Campanhas', value: stats?.total_campaigns || 0, icon: '📊' },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{stat.label}</p>
                <p className="font-heading font-bold text-3xl text-foreground mt-1">{stat.value}</p>
              </div>
              <span className="text-3xl opacity-50">{stat.icon}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card className="glass-card">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="font-heading font-semibold text-lg">Lista de Revendedores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-pulse text-primary font-mono">Carregando...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="font-heading font-semibold text-xl text-foreground mb-2">
                Nenhum revendedor encontrado
              </h3>
              <p className="text-muted-foreground mb-6">
                Crie seu primeiro revendedor para começar
              </p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
              >
                Criar Primeiro Revendedor
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Usuário</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Max. Conexões</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Status</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase">Criado em</TableHead>
                  <TableHead className="text-muted-foreground font-mono text-xs uppercase text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`} className="border-white/5 hover:bg-white/5">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="font-heading font-bold text-primary uppercase">
                            {user.username[0]}
                          </span>
                        </div>
                        <span>{user.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{user.max_connections}</span>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={user.active ? 'status-connected' : 'status-disconnected'}
                      >
                        {user.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          data-testid={`edit-user-${user.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                          className="border-white/10 hover:bg-white/5"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                        <Button
                          data-testid={`delete-user-${user.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setDeleteDialogOpen(true);
                          }}
                          className="border-destructive/20 text-destructive hover:bg-destructive/10"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass-card border-white/10">
          <DialogHeader>
            <DialogTitle className="font-heading">Editar Revendedor</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Atualize as configurações de {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Máximo de Conexões
              </Label>
              <Input
                data-testid="edit-user-connections"
                type="number"
                min={1}
                max={100}
                value={editData.max_connections}
                onChange={(e) => setEditData({ ...editData, max_connections: parseInt(e.target.value) || 1 })}
                className="h-12 bg-black/40 border-white/10"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg">
              <div>
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Status
                </Label>
                <p className="text-sm text-foreground mt-1">
                  {editData.active ? 'Ativo' : 'Inativo'}
                </p>
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
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
            >
              {actionLoading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Deletar Revendedor</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar o revendedor "{selectedUser?.username}"? 
              Todas as conexões e campanhas deste usuário serão removidas. Esta ação não pode ser desfeita.
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
