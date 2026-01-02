import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Package, Check, Copy, Wifi, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function MyPlansPage() {
  const { api, user, checkAuth } = useAuthStore();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await api.get('/my-plans');
      setPlans(response.data);
    } catch (error) {
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan) => {
    setSelectedPlan(plan);
    try {
      const response = await api.post(`/purchase-plan/${plan.id}`);
      setPaymentData(response.data);
      setPaymentDialog(true);
      
      // Start polling for payment
      startPaymentPolling(response.data.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao gerar pagamento');
    }
  };

  const startPaymentPolling = (transactionId) => {
    setCheckingPayment(true);
    const interval = setInterval(async () => {
      try {
        const response = await api.get('/transactions');
        const transaction = response.data.find(t => t.id === transactionId);
        
        if (transaction && transaction.status === 'approved') {
          clearInterval(interval);
          setCheckingPayment(false);
          toast.success('Pagamento confirmado! Seu plano foi ativado.');
          setPaymentDialog(false);
          // Refresh user data
          await checkAuth();
          fetchPlans();
        }
      } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
      }
    }, 5000); // Check every 5 seconds

    // Stop after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      setCheckingPayment(false);
    }, 600000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const isExpired = user?.expires_at && new Date(user.expires_at) < new Date();
  const daysRemaining = user?.expires_at 
    ? Math.ceil((new Date(user.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

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
        <h1 className="text-3xl font-bold text-foreground">Planos Disponíveis</h1>
        <p className="text-muted-foreground">Escolha um plano para ativar ou renovar sua conta</p>
      </div>

      {/* Current Status Card */}
      <Card className={`p-4 ${isExpired ? 'bg-red-500/10 border-red-500/30' : daysRemaining && daysRemaining <= 7 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
        <div className="flex items-start gap-3">
          {isExpired ? (
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          ) : (
            <Calendar className="w-5 h-5 text-blue-500 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${isExpired ? 'text-red-500' : 'text-blue-500'}`}>
              {isExpired ? 'Sua conta expirou!' : 'Status da sua conta'}
            </p>
            <p className={`text-xs mt-1 ${isExpired ? 'text-red-500/80' : 'text-blue-500/80'}`}>
              {isExpired 
                ? 'Escolha um plano abaixo para reativar sua conta.' 
                : daysRemaining && daysRemaining <= 7
                  ? `Sua conta expira em ${daysRemaining} dia${daysRemaining > 1 ? 's' : ''}. Renove agora!`
                  : user?.expires_at
                    ? `Expira em: ${new Date(user.expires_at).toLocaleDateString('pt-BR')}`
                    : 'Conta sem expiração definida'
              }
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              Conexões atuais: {user?.max_connections === -1 ? 'Ilimitadas' : user?.max_connections || 1}
            </p>
          </div>
        </div>
      </Card>

      {plans.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="p-6 hover:border-primary transition-all relative overflow-hidden">
              {/* Popular Badge - exemplo para destaque */}
              {plan.duration_months >= 6 && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
                  Mais Popular
                </div>
              )}
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                </div>

                <div className="py-4 border-y border-border">
                  <p className="text-3xl font-bold text-primary">R$ {plan.price.toFixed(2)}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" />
                    <span>{plan.duration_months} {plan.duration_months === 1 ? 'mês' : 'meses'} de acesso</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Wifi className="w-4 h-4 text-green-500" />
                    <span>{plan.max_connections === -1 ? 'Conexões ilimitadas' : `${plan.max_connections} conexão${plan.max_connections > 1 ? 'ões' : ''}`}</span>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  )}
                </div>

                <Button 
                  onClick={() => handlePurchase(plan)}
                  className="w-full"
                  size="lg"
                >
                  {isExpired ? 'Ativar Agora' : 'Renovar Agora'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum plano disponível no momento</p>
          <p className="text-sm text-muted-foreground mt-2">Entre em contato com seu revendedor.</p>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Pagamento via PIX</DialogTitle>
          </DialogHeader>
          
          {paymentData && (
            <div className="space-y-4">
              {selectedPlan && (
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Plano selecionado:</p>
                  <p className="font-bold">{selectedPlan.name}</p>
                  <p className="text-primary font-bold text-lg">R$ {selectedPlan.price.toFixed(2)}</p>
                </div>
              )}

              {checkingPayment && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-blue-500">Aguardando confirmação do pagamento...</p>
                </div>
              )}
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Escaneie o QR Code:</p>
                <img 
                  src={`data:image/png;base64,${paymentData.qr_code}`}
                  alt="QR Code PIX"
                  className="mx-auto w-64 h-64 border rounded-lg"
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Ou copie o código PIX:</Label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={paymentData.qr_code_text}
                    readOnly
                    className="flex-1 p-2 text-xs border rounded bg-muted font-mono"
                  />
                  <Button 
                    size="sm"
                    onClick={() => copyToClipboard(paymentData.qr_code_text)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-xs text-yellow-600">
                  ⏱️ Após o pagamento, a confirmação pode levar até 2 minutos.
                  Seu plano será ativado automaticamente.
                </p>
              </div>

              <Button 
                variant="outline" 
                onClick={() => setPaymentDialog(false)}
                className="w-full"
              >
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
