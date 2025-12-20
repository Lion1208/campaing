import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Users, Wifi, Coins, Edit2, Trash2, RefreshCw, ChevronLeft, ChevronRight, Calendar, Shield, User, Gift, Copy, Check } from 'lucide-react';
import { api } from '@/store';

// Receipt Modal Component
function ReceiptModal({ open, onClose, receipt }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    if (receipt?.text) {
      await navigator.clipboard.writeText(receipt.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Comprovante copiado!');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card border-border mx-4 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            {receipt?.action === 'trial' ? (
              <>
                <Gift className="w-5 h-5 text-primary" />
                Teste Liberado!
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 text-primary" />
                Renovação Realizada!
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Copie o comprovante abaixo para enviar ao cliente
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-foreground border border-border">
            {receipt?.text}
          </div>
          <Button
            onClick={handleCopy}
            className="w-full bg-primary text-primary-foreground"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copiar Comprovante
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ResellersPage() {
  const { user, checkAuth } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [addCreditsDialogOpen, setAddCreditsDialogOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', max_connections: 1, role: 'reseller', credits: 0 });
  const [editData, setEditData] = useState({ max_connections: 1, active: true });
  const [creditsToAdd, setCreditsToAdd] = useState(10);
  const [actionLoading, setActionLoading] = useState(false);
  const limit = 10;

  const isAdmin = user?.role === 'admin';
  const isMaster = user?.role === 'master';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin ? `/admin/all-users?page=${page}&limit=${limit}` : `/master/resellers?page=${page}&limit=${limit}`;
      const response = await api.get(endpoint);
      setUsers(response.data.users);
      setTotalPages(response.data.total_pages);
      setTotal(response.data.total);
    } catch (error) {
      toast.error('Erro ao carregar revendedores');
    } finally {
      setLoading(false);
    }
  }, [page, isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (isMaster && (user?.credits || 0) < 1) {
      toast.error('Você não tem créditos suficientes para criar um revendedor');
      return;
    }

    setActionLoading(true);
    try {
      const endpoint = isAdmin ? '/admin/users' : '/master/resellers';
      const payload = isAdmin ? newUser : {
        username: newUser.username.trim(),
        password: newUser.password,
        max_connections: newUser.max_connections
      };
      
      await api.post(endpoint, payload);
      toast.success('Revendedor criado!');
      setCreateDialogOpen(false);
      setNewUser({ username: '', password: '', max_connections: 1, role: 'reseller', credits: 0 });
      fetchUsers();
      if (isMaster) await checkAuth();
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
      const endpoint = isAdmin ? `/admin/users/${selectedUser.id}` : `/master/resellers/${selectedUser.id}`;
      await api.put(endpoint, editData);
      toast.success('Revendedor atualizado');
      setEditDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenew = async () => {
    if (!selectedUser) return;

    if (isMaster && (user?.credits || 0) < 1) {
      toast.error('Você não tem créditos suficientes para renovar');
      return;
    }

    setActionLoading(true);
    try {
      const endpoint = isAdmin ? `/admin/users/${selectedUser.id}/renew` : `/master/resellers/${selectedUser.id}/renew`;
      const response = await api.post(endpoint);
      
      setRenewDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
      if (isMaster) await checkAuth();
      
      // Show receipt modal
      if (response.data.receipt) {
        setCurrentReceipt(response.data.receipt);
        setReceiptModalOpen(true);
      } else {
        toast.success('Renovado por mais 1 mês!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao renovar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTrial = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const endpoint = isAdmin ? `/admin/users/${selectedUser.id}/trial` : `/master/resellers/${selectedUser.id}/trial`;
      const response = await api.post(endpoint);
      
      setTrialDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
      
      // Show receipt modal
      if (response.data.receipt) {
        setCurrentReceipt(response.data.receipt);
        setReceiptModalOpen(true);
      } else {
        toast.success('Teste de 24h liberado!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao liberar teste');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCredits = async () => {
    if (!selectedUser || !isAdmin) return;

    setActionLoading(true);
    try {
      await api.post(`/admin/users/${selectedUser.id}/add-credits?amount=${creditsToAdd}`);
      toast.success(`${creditsToAdd} créditos adicionados!`);
      setAddCreditsDialogOpen(false);
      setSelectedUser(null);
      setCreditsToAdd(10);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao adicionar créditos');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const endpoint = isAdmin ? `/admin/users/${selectedUser.id}` : `/master/resellers/${selectedUser.id}`;
      await api.delete(endpoint);
      toast.success('Revendedor deletado');
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao deletar');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditDialog = (u) => {
    setSelectedUser(u);
    setEditData({ max_connections: u.max_connections, active: u.active });
    setEditDialogOpen(true);
  };

  const getRoleBadge = (role) => {
    const config = {
      master: { class: 'status-active', label: 'Master', icon: Shield },
      reseller: { class: 'status-pending', label: 'Revendedor', icon: User }
    };
    const c = config[role] || config.reseller;
    const Icon = c.icon;
    return (
      <Badge variant="outline" className={`${c.class} text-[10px] uppercase tracking-wider gap-1`}>
        <Icon className="w-3 h-3" />
        {c.label}
      </Badge>
    );
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const canHaveTrial = (u) => {
    return !u.had_trial && !u.active && !u.expires_at;
  };

  return (
    <div data-testid="resellers-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Revendedores</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} revendedores • 
            {isMaster && (
              <span className="text-primary font-medium ml-1">{user?.credits || 0} créditos disponíveis</span>
            )}
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow">
              <Plus className="w-4 h-4 mr-2" />
              Novo Revendedor
              {isMaster && <span className="ml-1 text-xs opacity-75">(1 crédito)</span>}
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border mx-4 max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-foreground">Novo Revendedor</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {isMaster 
                  ? `Criar revendedor custará 1 crédito. Você tem ${user?.credits || 0} créditos.`
                  : 'Adicione um novo revendedor ao sistema (créditos ilimitados)'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-foreground">Usuário</Label>
                <Input
                  placeholder="Nome de usuário"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="bg-muted/50 border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Senha</Label>
                <Input
                  type="password"
                  placeholder="Senha"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="bg-muted/50 border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Máximo de Conexões</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newUser.max_connections}
                  onChange={(e) => setNewUser({ ...newUser, max_connections: parseInt(e.target.value) || 1 })}
                  className="bg-muted/50 border-border text-foreground"
                />
              </div>
              {isAdmin && (
                <>
                  <div className="space-y-2">
                    <Label className="text-foreground">Tipo</Label>
                    <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                      <SelectTrigger className="bg-muted/50 border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reseller">Revendedor</SelectItem>
                        <SelectItem value="master">Master</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUser.role === 'master' && (
                    <div className="space-y-2">
                      <Label className="text-foreground">Créditos Iniciais</Label>
                      <Input
                        type="number"
                        min={0}
                        value={newUser.credits}
                        onChange={(e) => setNewUser({ ...newUser, credits: parseInt(e.target.value) || 0 })}
                        className="bg-muted/50 border-border text-foreground"
                      />
                    </div>
                  )}
                </>
              )}
              <Button
                onClick={handleCreate}
                disabled={actionLoading || (isMaster && (user?.credits || 0) < 1)}
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
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total</p>
              <p className="font-heading font-bold text-2xl text-foreground">{total}</p>
            </div>
            <Users className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ativos</p>
              <p className="font-heading font-bold text-2xl text-primary">{users.filter(u => u.active && !isExpired(u.expires_at)).length}</p>
            </div>
            <Users className="w-5 h-5 text-primary" />
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Expirados</p>
              <p className="font-heading font-bold text-2xl text-destructive">{users.filter(u => isExpired(u.expires_at)).length}</p>
            </div>
            <Calendar className="w-5 h-5 text-destructive" />
          </CardContent>
        </Card>
        {isMaster && (
          <Card className="glass-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Seus Créditos</p>
                <p className="font-heading font-bold text-2xl text-yellow-500">{user?.credits || 0}</p>
              </div>
              <Coins className="w-5 h-5 text-yellow-500" />
            </CardContent>
          </Card>
        )}
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
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">Nenhum revendedor</h3>
            <p className="text-muted-foreground text-sm mb-4">Crie seu primeiro revendedor</p>
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary text-primary-foreground">
              Criar Revendedor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((u, index) => (
            <Card
              key={u.id}
              className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      u.role === 'master' ? 'bg-yellow-500/15' : 'bg-primary/15'
                    }`}>
                      <span className={`font-heading font-bold uppercase ${
                        u.role === 'master' ? 'text-yellow-500' : 'text-primary'
                      }`}>
                        {u.username[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-foreground">{u.username}</p>
                        {getRoleBadge(u.role)}
                        <Badge variant="outline" className={u.active && !isExpired(u.expires_at) ? 'status-connected' : 'status-disconnected'}>
                          {!u.active ? 'Bloqueado' : isExpired(u.expires_at) ? 'Expirado' : 'Ativo'}
                        </Badge>
                        {u.had_trial && (
                          <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
                            Já testou
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Wifi className="w-3 h-3" />
                          {u.max_connections === -1 ? '∞' : u.max_connections} conexões
                        </span>
                        {u.role === 'master' && (
                          <span className="flex items-center gap-1 text-yellow-500">
                            <Coins className="w-3 h-3" />
                            {u.credits || 0} créditos
                          </span>
                        )}
                        {u.expires_at && (
                          <span className={`flex items-center gap-1 ${isExpired(u.expires_at) ? 'text-destructive' : ''}`}>
                            <Calendar className="w-3 h-3" />
                            {isExpired(u.expires_at) ? 'Expirou' : 'Expira'}: {new Date(u.expires_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {/* Trial Button - Only for users who never had trial */}
                    {canHaveTrial(u) && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(u);
                          setTrialDialogOpen(true);
                        }}
                        className="border-purple-500/30 text-purple-500 hover:bg-purple-500/10 h-8 w-8"
                        title="Liberar Teste (24h)"
                      >
                        <Gift className="w-4 h-4" />
                      </Button>
                    )}
                    {/* Renew Button */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectedUser(u);
                        setRenewDialogOpen(true);
                      }}
                      className="border-primary/30 text-primary hover:bg-primary/10 h-8 w-8"
                      title="Renovar (+1 mês)"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    {/* Add Credits (Admin only, for masters) */}
                    {isAdmin && u.role === 'master' && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(u);
                          setAddCreditsDialogOpen(true);
                        }}
                        className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 h-8 w-8"
                        title="Adicionar créditos"
                      >
                        <Coins className="w-4 h-4" />
                      </Button>
                    )}
                    {/* Edit */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => openEditDialog(u)}
                      className="border-border h-8 w-8"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {/* Delete */}
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setSelectedUser(u);
                        setDeleteDialogOpen(true);
                      }}
                      className="border-destructive/20 text-destructive hover:bg-destructive/10 h-8 w-8"
                      title="Deletar"
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-border"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-border"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal 
        open={receiptModalOpen} 
        onClose={() => setReceiptModalOpen(false)} 
        receipt={currentReceipt} 
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass-card border-border mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Revendedor</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Atualize as configurações de {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-foreground">Máximo de Conexões</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={editData.max_connections}
                onChange={(e) => setEditData({ ...editData, max_connections: parseInt(e.target.value) || 1 })}
                className="bg-muted/50 border-border text-foreground"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-foreground">Status</Label>
                <p className="text-sm text-muted-foreground">{editData.active ? 'Ativo' : 'Bloqueado'}</p>
              </div>
              <Switch
                checked={editData.active}
                onCheckedChange={(checked) => setEditData({ ...editData, active: checked })}
              />
            </div>
            <Button
              onClick={handleUpdate}
              disabled={actionLoading}
              className="w-full bg-primary text-primary-foreground"
            >
              {actionLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trial Dialog */}
      <AlertDialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
        <AlertDialogContent className="glass-card border-border mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-500" />
              Liberar Teste
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Liberar teste de 24 horas para &ldquo;{selectedUser?.username}&rdquo;? 
              <br /><br />
              <span className="text-yellow-500">⚠️ O usuário só pode ter 1 teste. Após isso, precisará renovar.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTrial}
              className="bg-purple-500 text-white hover:bg-purple-600"
            >
              {actionLoading ? 'Liberando...' : 'Liberar Teste (24h)'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renew Dialog */}
      <AlertDialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <AlertDialogContent className="glass-card border-border mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Renovar Revendedor</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {isMaster 
                ? `Renovar "${selectedUser?.username}" por +1 mês custará 1 crédito. Você tem ${user?.credits || 0} créditos.`
                : `Renovar "${selectedUser?.username}" por mais 1 mês? (créditos ilimitados)`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRenew}
              disabled={isMaster && (user?.credits || 0) < 1}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {actionLoading ? 'Renovando...' : 'Renovar (+1 mês)'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Credits Dialog */}
      <Dialog open={addCreditsDialogOpen} onOpenChange={setAddCreditsDialogOpen}>
        <DialogContent className="glass-card border-border mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Adicionar Créditos</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Adicionar créditos para {selectedUser?.username} (atual: {selectedUser?.credits || 0})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-foreground">Quantidade de Créditos</Label>
              <Input
                type="number"
                min={1}
                value={creditsToAdd}
                onChange={(e) => setCreditsToAdd(parseInt(e.target.value) || 1)}
                className="bg-muted/50 border-border text-foreground"
              />
            </div>
            <Button
              onClick={handleAddCredits}
              disabled={actionLoading}
              className="w-full bg-yellow-500 text-yellow-950 hover:bg-yellow-400"
            >
              {actionLoading ? 'Adicionando...' : `Adicionar ${creditsToAdd} Créditos`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-border mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deletar Revendedor</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar &ldquo;{selectedUser?.username}&rdquo;? Todas as conexões e campanhas serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
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
