import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { CreditCard, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function GatewaysPage() {
  const { api, user } = useAuthStore();
  const [gateways, setGateways] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'mercadopago',
    access_token: '',
    monthly_price: 49.90,
    custom_prices: {}
  });

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      const response = await api.get('/gateways');
      setGateways(response.data);
    } catch (error) {
      toast.error('Erro ao carregar gateways');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await api.post('/gateways', formData);
      toast.success('Gateway configurado!');
      setDialogOpen(false);
      fetchGateways();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar gateway');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este gateway?')) return;
    
    try {
      await api.delete(`/gateways/${id}`);
      toast.success('Gateway deletado!');
      fetchGateways();
    } catch (error) {
      toast.error('Erro ao deletar gateway');
    }
  };

  const resetForm = () => {
    setFormData({
      provider: 'mercadopago',
      access_token: '',
      monthly_price: 49.90,
      custom_prices: {}
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
          <h1 className="text-3xl font-bold text-foreground">Gateway de Pagamento</h1>
          <p className="text-muted-foreground">Configure seu Mercado Pago para receber renovações</p>
        </div>
        {gateways.length === 0 && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Configurar Gateway
          </Button>
        )}
      </div>

      {gateways.length > 0 ? (
        <div className="grid gap-4">
          {gateways.map((gateway) => (
            <Card key={gateway.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <CreditCard className="w-6 h-6 text-primary" />
                    <h3 className="font-bold text-lg capitalize">{gateway.provider}</h3>
                    <div className="px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded">
                      {gateway.active ? 'Ativo' : 'Inativo'}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Token:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {gateway.access_token_preview}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Preço Padrão:</span>
                      <span className="font-bold text-primary">R$ {gateway.monthly_price.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setFormData({
                      provider: gateway.provider,
                      access_token: '',
                      monthly_price: gateway.monthly_price,
                      custom_prices: gateway.custom_prices
                    });
                    setDialogOpen(true);
                  }}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(gateway.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-bold text-lg mb-2">Configure seu Gateway</h3>
          <p className="text-muted-foreground mb-4">
            Configure o Mercado Pago para começar a receber pagamentos de renovações
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            Configurar Agora
          </Button>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Configurar Gateway Mercado Pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Access Token do Mercado Pago</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  value={formData.access_token}
                  onChange={(e) => setFormData({...formData, access_token: e.target.value})}
                  placeholder="APP_USR-xxxx-xxxx-xxxx-xxxx"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Obtenha em: <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" className="text-primary underline">Mercado Pago Developers</a>
              </p>
            </div>

            <div>
              <Label>Preço Mensal Padrão (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.monthly_price}
                onChange={(e) => setFormData({...formData, monthly_price: parseFloat(e.target.value)})}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este será o preço padrão para renovações dos seus usuários
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-500">
                💡 <strong>Dica:</strong> Você pode definir preços personalizados para cada revendedor na página de Revendedores.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Salvar Gateway
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
