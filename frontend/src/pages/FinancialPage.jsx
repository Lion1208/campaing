import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Card } from '../components/ui/card';
import { DollarSign, TrendingUp, Users, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

export default function FinancialPage() {
  const { api, user } = useAuthStore();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_revenue: 0,
    total_renewals: 0,
    total_credits_sold: 0,
    pending_amount: 0
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await api.get('/transactions');
      const txs = response.data;
      setTransactions(txs);
      
      // Calculate stats
      const approved = txs.filter(t => t.status === 'approved');
      const pending = txs.filter(t => t.status === 'pending');
      
      setStats({
        total_revenue: approved.reduce((sum, t) => sum + t.amount, 0),
        total_renewals: approved.filter(t => t.type === 'renewal').length,
        total_credits_sold: approved.filter(t => t.type === 'credit_purchase').reduce((sum, t) => sum + (t.credits_amount || 0), 0),
        pending_amount: pending.reduce((sum, t) => sum + t.amount, 0)
      });
    } catch (error) {
      toast.error('Erro ao carregar transações');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      approved: 'bg-green-500/20 text-green-500',
      pending: 'bg-yellow-500/20 text-yellow-500',
      cancelled: 'bg-red-500/20 text-red-500'
    };
    
    const labels = {
      approved: 'Aprovado',
      pending: 'Pendente',
      cancelled: 'Cancelado'
    };
    
    return (
      <span className={`px-2 py-1 text-xs rounded ${colors[status] || 'bg-gray-500/20 text-gray-500'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const colors = {
      renewal: 'bg-blue-500/20 text-blue-500',
      credit_purchase: 'bg-purple-500/20 text-purple-500'
    };
    
    const labels = {
      renewal: 'Renovação',
      credit_purchase: 'Compra de Créditos'
    };
    
    return (
      <span className={`px-2 py-1 text-xs rounded ${colors[type] || 'bg-gray-500/20 text-gray-500'}`}>
        {labels[type] || type}
      </span>
    );
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground">Histórico de transações e estatísticas</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Faturamento Total</p>
              <p className="text-2xl font-bold text-green-500">R$ {stats.total_revenue.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Renovações</p>
              <p className="text-2xl font-bold text-blue-500">{stats.total_renewals}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Créditos Vendidos</p>
              <p className="text-2xl font-bold text-purple-500">{stats.total_credits_sold}</p>
            </div>
            <CreditCard className="w-8 h-8 text-purple-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pagamentos Pendentes</p>
              <p className="text-2xl font-bold text-yellow-500">R$ {stats.pending_amount.toFixed(2)}</p>
            </div>
            <Users className="w-8 h-8 text-yellow-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Histórico de Transações</h2>
        
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Usuário</th>
                  {user?.role === 'admin' && (
                    <th className="pb-3 text-sm font-medium text-muted-foreground">Master</th>
                  )}
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Valor</th>
                  <th className="pb-3 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b last:border-0">
                    <td className="py-3 text-sm">
                      {new Date(tx.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3">
                      {getTypeBadge(tx.type)}
                    </td>
                    <td className="py-3 text-sm">
                      {tx.username || 'N/A'}
                    </td>
                    {user?.role === 'admin' && (
                      <td className="py-3 text-sm">
                        {tx.master_username || '-'}
                      </td>
                    )}
                    <td className="py-3 font-bold text-sm">
                      R$ {tx.amount.toFixed(2)}
                    </td>
                    <td className="py-3">
                      {getStatusBadge(tx.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhuma transação encontrada</p>
        )}
      </Card>
    </div>
  );
}
