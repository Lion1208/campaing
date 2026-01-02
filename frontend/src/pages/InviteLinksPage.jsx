import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Link2, Plus, Trash2, Copy, Users, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function InviteLinksPage() {
  const { api, user } = useAuthStore();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('mine');
  const [formData, setFormData] = useState({
    test_hours: 24,
    max_uses: 0,
    expires_in_hours: 24
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchLinks();
  }, [ownerFilter]);

  const fetchLinks = async () => {
    try {
      const response = await api.get(`/invite-links?owner_filter=${ownerFilter}`);
      setLinks(response.data);
    } catch (error) {
      toast.error('Erro ao carregar links');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await api.post('/invite-links', formData);
      toast.success('Link criado!');
      setDialogOpen(false);
      fetchLinks();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar link');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este link?')) return;
    
    try {
      await api.delete(`/invite-links/${id}`);
      toast.success('Link deletado!');
      fetchLinks();
    } catch (error) {
      toast.error('Erro ao deletar link');
    }
  };

  const copyInviteUrl = (code) => {
    const url = `${window.location.origin}/register/${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const resetForm = () => {
    setFormData({
      test_hours: 24,
      max_uses: 0,
      expires_in_hours: 24
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Links de Convite</h1>
          <p className="text-muted-foreground">Crie links para novos usuários se cadastrarem</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Admin Filter */}
          {isAdmin && (
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[180px] bg-muted/50 border-border">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos do Sistema</SelectItem>
                <SelectItem value="mine">Apenas Meus</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Link
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {links.map((link) => {
          const isExpired = new Date(link.expires_at) < new Date();
          const isMaxed = link.max_uses > 0 && link.uses >= link.max_uses;
          
          return (
            <Card key={link.id} className={`p-6 ${(isExpired || isMaxed) ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Link2 className="w-5 h-5 text-primary" />
                    <code className="text-lg font-mono font-bold">{link.code}</code>
                    {isExpired && (
                      <span className="px-2 py-1 bg-red-500/20 text-red-500 text-xs rounded">
                        Expirado
                      </span>
                    )}
                    {isMaxed && (
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-500 text-xs rounded">
                        Esgotado
                      </span>
                    )}
                    {link.active && !isExpired && !isMaxed && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded">
                        Ativo
                      </span>
                    )}
                    {/* Creator badge for admin viewing all */}
                    {isAdmin && ownerFilter === 'all' && link.creator_username && (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                        {link.creator_username}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Teste:</span>
                      <p className="font-medium">{link.test_hours}h</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Usos:</span>
                      <p className="font-medium">
                        {link.uses} / {link.max_uses === 0 ? '∞' : link.max_uses}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expira em:</span>
                      <p className="font-medium">
                        {new Date(link.expires_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Criado em:</span>
                      <p className="font-medium">
                        {new Date(link.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyInviteUrl(link.code)}
                      disabled={isExpired || isMaxed}
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copiar Link
                    </Button>
                  </div>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelete(link.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {links.length === 0 && (
        <Card className="p-12 text-center">
          <Link2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Nenhum link de convite criado</p>
          <Button onClick={() => setDialogOpen(true)}>
            Criar Primeiro Link
          </Button>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Link de Convite</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Duração do Teste (horas)</Label>
              <Input
                type="number"
                min="1"
                max="24"
                value={formData.test_hours}
                onChange={(e) => setFormData({...formData, test_hours: parseInt(e.target.value)})}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usuários terão acesso por este período após ativação manual
              </p>
            </div>

            <div>
              <Label>Máximo de Usos (0 = ilimitado)</Label>
              <Input
                type="number"
                min="0"
                value={formData.max_uses}
                onChange={(e) => setFormData({...formData, max_uses: parseInt(e.target.value)})}
                required
              />
            </div>

            <div>
              <Label>Link Expira em (horas)</Label>
              <Input
                type="number"
                min="1"
                max="24"
                value={formData.expires_in_hours}
                onChange={(e) => setFormData({...formData, expires_in_hours: parseInt(e.target.value)})}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Após este período, o link não funcionará mais
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-sm text-yellow-600">
                ⚠️ Usuários cadastrados via link começam <strong>bloqueados</strong>. Você deve ativar o teste manualmente na página de Revendedores.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Criar Link
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
