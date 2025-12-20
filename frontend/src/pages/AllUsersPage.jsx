import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Shield, User, Search, ChevronLeft, ChevronRight, Calendar, Coins, Wifi } from 'lucide-react';
import { api } from '@/store';

export default function AllUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const limit = 10;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/admin/all-users?page=${page}&limit=${limit}`);
      setUsers(response.data.users);
      setTotalPages(response.data.total_pages);
      setTotal(response.data.total);
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const getRoleBadge = (role) => {
    const config = {
      admin: { class: 'status-connected', label: 'Admin', icon: Shield },
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

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div data-testid="all-users-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} usuários no sistema</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome de usuário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-muted/50 border-border text-foreground"
        />
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">Nenhum usuário encontrado</h3>
            <p className="text-muted-foreground text-sm">Tente ajustar os filtros de busca</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user, index) => (
            <Card
              key={user.id}
              className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <span className="font-heading font-bold text-primary uppercase">
                        {user.username[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-foreground">{user.username}</p>
                        {getRoleBadge(user.role)}
                        <Badge variant="outline" className={user.active ? 'status-connected' : 'status-disconnected'}>
                          {user.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Wifi className="w-3 h-3" />
                          {user.max_connections === -1 ? '∞' : user.max_connections} conexões
                        </span>
                        {user.role === 'master' && (
                          <span className="flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            {user.credits || 0} créditos
                          </span>
                        )}
                        {user.expires_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expira: {new Date(user.expires_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        <span>Criado: {new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
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
    </div>
  );
}
