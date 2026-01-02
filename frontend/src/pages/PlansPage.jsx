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
import { Plus, Edit2, Trash2, Package, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function PlansPage() {
  const { api, user } = useAuthStore();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    role: 'reseller',
    max_connections: 1,
    duration_months: 1,
    price: 0,
    description: '',
    active: true
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchPlans();
  }, [ownerFilter]);

  const fetchPlans = async () => {
    try {
      const response = await api.get(`/plans?owner_filter=${ownerFilter}`);
      setPlans(response.data);
    } catch (error) {
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingPlan) {
        await api.put(`/admin/plans/${editingPlan.id}`, formData);
        toast.success('Plano atualizado!');
      } else {
        await api.post('/admin/plans', formData);
        toast.success('Plano criado!');
      }
      setDialogOpen(false);
      fetchPlans();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar plano');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este plano?')) return;
    
    try {
      await api.delete(`/admin/plans/${id}`);
      toast.success('Plano deletado!');
      fetchPlans();
    } catch (error) {
      toast.error('Erro ao deletar plano');
    }
  };

  const openDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData(plan);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      role: 'reseller',
      max_connections: 1,
      duration_months: 1,
      price: 0,
      description: '',
      active: true
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
          <h1 className="text-3xl font-bold text-foreground">Planos</h1>
          <p className="text-muted-foreground">Configure os planos de renovação</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-lg">{plan.name}</h3>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openDialog(plan)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(plan.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium capitalize">{plan.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Conexões:</span>
                <span className="font-medium">{plan.max_connections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duração:</span>
                <span className="font-medium">{plan.duration_months} mês(es)</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-muted-foreground">Preço:</span>
                <span className="font-bold text-primary text-lg">
                  R$ {plan.price.toFixed(2)}
                </span>
              </div>
              {plan.description && (
                <p className="text-muted-foreground text-xs pt-2 border-t">
                  {plan.description}
                </p>
              )}
              <div className="flex items-center gap-2 pt-2">
                <div className={`w-2 h-2 rounded-full ${plan.active ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs">{plan.active ? 'Ativo' : 'Inativo'}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum plano cadastrado</p>
          <Button onClick={() => openDialog()} className="mt-4">
            Criar Primeiro Plano
          </Button>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome do Plano</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Plano Revendedor"
                required
              />
            </div>

            <div>
              <Label>Tipo</Label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full p-2 border rounded-md bg-background"
                required
              >
                <option value="reseller">Revendedor</option>
                <option value="master">Master</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Conexões</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_connections}
                  onChange={(e) => setFormData({...formData, max_connections: parseInt(e.target.value)})}
                  required
                />
              </div>
              <div>
                <Label>Duração (meses)</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.duration_months}
                  onChange={(e) => setFormData({...formData, duration_months: parseInt(e.target.value)})}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Preço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value)})}
                required
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Até 5 conexões"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({...formData, active: e.target.checked})}
                className="rounded"
              />
              <Label>Plano Ativo</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                {editingPlan ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
