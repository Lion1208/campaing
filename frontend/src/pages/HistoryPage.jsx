import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { History, ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Coins, RefreshCw, Play, Pause, Copy, User } from 'lucide-react';
import { api } from '@/store';

export default function HistoryPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterAction, setFilterAction] = useState('all');
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (filterAction !== 'all') {
        params.append('action', filterAction);
      }
      const response = await api.get(`/activity-logs/paginated?${params}`);
      setLogs(response.data.logs);
      setTotalPages(response.data.total_pages);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionIcon = (action) => {
    const icons = {
      create: Plus,
      update: Edit2,
      delete: Trash2,
      add_credits: Coins,
      renew: RefreshCw,
      start: Play,
      pause: Pause,
      resume: Play,
      duplicate: Copy,
      block: Pause,
      unblock: Play,
      grant_trial: User,
    };
    return icons[action] || History;
  };

  const getActionColor = (action) => {
    const colors = {
      create: 'text-green-500 bg-green-500/10',
      update: 'text-blue-500 bg-blue-500/10',
      delete: 'text-red-500 bg-red-500/10',
      add_credits: 'text-yellow-500 bg-yellow-500/10',
      renew: 'text-purple-500 bg-purple-500/10',
      start: 'text-green-500 bg-green-500/10',
      pause: 'text-orange-500 bg-orange-500/10',
      resume: 'text-green-500 bg-green-500/10',
      duplicate: 'text-cyan-500 bg-cyan-500/10',
      block: 'text-red-500 bg-red-500/10',
      unblock: 'text-green-500 bg-green-500/10',
      grant_trial: 'text-purple-500 bg-purple-500/10',
    };
    return colors[action] || 'text-gray-500 bg-gray-500/10';
  };

  const getActionLabel = (action) => {
    const labels = {
      create: 'Criação',
      update: 'Edição',
      delete: 'Exclusão',
      add_credits: 'Créditos',
      renew: 'Renovação',
      start: 'Início',
      pause: 'Pausado',
      resume: 'Retomado',
      duplicate: 'Duplicado',
      profile_update: 'Perfil',
      password_change: 'Senha',
      block: 'Bloqueio',
      unblock: 'Desbloqueio',
      grant_trial: 'Teste Grátis',
    };
    return labels[action] || action;
  };

  const getEntityLabel = (type) => {
    const labels = {
      campaign: 'Campanha',
      user: 'Usuário',
      reseller: 'Revendedor',
      template: 'Template',
      connection: 'Conexão',
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div data-testid="history-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Histórico</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} ações registradas</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(1); }}>
            <SelectTrigger className="w-40 bg-muted/50 border-border text-foreground">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ações</SelectItem>
              <SelectItem value="create">Criação</SelectItem>
              <SelectItem value="update">Edição</SelectItem>
              <SelectItem value="delete">Exclusão</SelectItem>
              <SelectItem value="add_credits">Créditos</SelectItem>
              <SelectItem value="renew">Renovação</SelectItem>
              <SelectItem value="block">Bloqueio</SelectItem>
              <SelectItem value="unblock">Desbloqueio</SelectItem>
              <SelectItem value="grant_trial">Teste Grátis</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <History className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">Nenhuma ação registrada</h3>
            <p className="text-muted-foreground text-sm">O histórico aparecerá aqui</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log, index) => {
            const Icon = getActionIcon(log.action);
            const colorClass = getActionColor(log.action);
            
            return (
              <Card
                key={log.id}
                className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={colorClass.replace('bg-', 'border-').replace('/10', '/30')}>
                          {getActionLabel(log.action)}
                        </Badge>
                        <Badge variant="outline" className="text-muted-foreground">
                          {getEntityLabel(log.entity_type)}
                        </Badge>
                      </div>
                      
                      <p className="text-foreground font-medium">
                        {log.entity_name && (
                          <span className="text-primary">"{log.entity_name}"</span>
                        )}
                        {log.details && (
                          <span className="text-muted-foreground font-normal ml-1">— {log.details}</span>
                        )}
                      </p>
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.username}
                        </span>
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
