import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Plus, Edit2, Trash2, Coins, Package } from 'lucide-react';
import { toast } from 'sonner';

export default function CreditPlansAdminPage() {
  const { api } = useAuthStore();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planToDelete, setPlanToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    credits: 10,
    price: 50,
    description: '',
    active: true
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await api.get('/admin/credit-plans');
      setPlans(response.data);
    } catch (error) {
      toast.error('Erro ao carregar pacotes');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        credits: plan.credits,
        price: plan.price,
        description: plan.description || '',
        active: plan.active
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        credits: 10,
        price: 50,
        description: '',
        active: true
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.credits < 1 || formData.price < 0.01) {
      toast.error('Preencha todos os campos corretamente');
      return;
    }

    try {
      if (editingPlan) {
        await api.put(`/admin/credit-plans/${editingPlan.id}`, formData);
        toast.success('Pacote atualizado!');
      } else {
        await api.post('/admin/credit-plans', formData);
        toast.success('Pacote criado!');
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar pacote');
    }
  };

  const confirmDelete = (plan) => {
    setPlanToDelete(plan);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!planToDelete) return;
    
    try {
      await api.delete(`/admin/credit-plans/${planToDelete.id}`);
      toast.success('Pacote excluído!');
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
      fetchPlans();
    } catch (error) {
      toast.error('Erro ao excluir pacote');
    }
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
          <h1 className="text-3xl font-bold text-foreground">Pacotes de Créditos</h1>
          <p className="text-muted-foreground">Configure os pacotes para masters comprarem</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Pacote
        </Button>
      </div>

      {/* Info Card */}
      <Card className="p-4 bg-blue-500/10 border-blue-500/30">
        <div className="flex items-start gap-3">
          <Coins className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-500">Como funciona?</p>
            <p className="text-xs text-blue-500/80 mt-1">
              Os pacotes de créditos ficam disponíveis na "Loja de Créditos" para os Masters. 
              Quando um Master comprar, o pagamento é processado pelo seu gateway MercadoPago e os créditos são adicionados automaticamente após confirmação.
            </p>
          </div>
        </div>
      </Card>

      {plans.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={`p-6 relative ${!plan.active ? 'opacity-50' : ''}`}>
              {/* Status Badge */}
              <Badge 
                variant="outline" 
                className={`absolute top-4 right-4 ${plan.active ? 'status-connected' : 'bg-muted text-muted-foreground'}`}
              >
                {plan.active ? 'Ativo' : 'Inativo'}
              </Badge>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Créditos:</span>
                    <span className="font-bold text-xl text-primary">{plan.credits}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Preço:</span>
                    <span className="font-bold text-lg">R$ {plan.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Por crédito:</span>
                    <span className="text-muted-foreground">R$ {(plan.price / plan.credits).toFixed(2)}</span>
                  </div>
                </div>

                {plan.description && (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                )}

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openDialog(plan)}>
                    <Edit2 className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => confirmDelete(plan)}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Excluir
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Coins className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Nenhum pacote de créditos criado</p>
          <Button onClick={() => openDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Criar Primeiro Pacote
          </Button>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Pacote' : 'Novo Pacote de Créditos'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nome do Pacote</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Pacote Básico"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantidade de Créditos</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {formData.credits > 0 && formData.price > 0 && (
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Preço por crédito: <strong className="text-foreground">R$ {(formData.price / formData.credits).toFixed(2)}</strong>
                </p>
              </div>
            )}

            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Ideal para pequenos revendedores"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Pacote Ativo</Label>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>

            <Button onClick={handleSubmit} className="w-full">
              {editingPlan ? 'Salvar Alterações' : 'Criar Pacote'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pacote</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o pacote "{planToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
