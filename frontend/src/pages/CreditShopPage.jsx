import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ShoppingCart, Check, Copy, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CreditShopPage() {
  const { api, user } = useAuthStore();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await api.get('/credit-plans');
      setPlans(response.data);
    } catch (error) {
      toast.error('Erro ao carregar planos');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (planId) => {
    try {
      const response = await api.post(`/purchase-credits/${planId}`);
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
          toast.success('Pagamento confirmado! Créditos adicionados.');
          setPaymentDialog(false);
          window.location.reload();
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
        <h1 className="text-3xl font-bold text-foreground">Loja de Créditos</h1>
        <p className="text-muted-foreground">Compre créditos para renovar seus usuários</p>
        <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-500">
            💰 Seu saldo atual: <strong>{user?.credits || 0} créditos</strong>
          </p>
          <p className="text-xs text-blue-500/80 mt-1">
            Cada renovação consome 1 crédito. Mantenha sempre mais de 1 crédito para habilitar renovação automática.
          </p>
        </div>
      </div>

      {plans.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="p-6 hover:border-primary transition-all">
              <div className="text-center space-y-4">
                <div>
                  <h3 className="font-bold text-2xl mb-1">{plan.credits} Créditos</h3>
                  <p className="text-muted-foreground text-sm">{plan.name}</p>
                </div>
                
                <div className="py-4 border-y border-border">
                  <p className="text-3xl font-bold text-primary">R$ {plan.price.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    R$ {(plan.price / plan.credits).toFixed(2)} por crédito
                  </p>
                </div>
                
                <Button 
                  onClick={() => handlePurchase(plan.id)}
                  className="w-full"
                  size="lg"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Comprar Agora
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum plano de crédito disponível no momento</p>
        </Card>
      )}

      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Pagamento via PIX</DialogTitle>
          </DialogHeader>
          
          {paymentData && (
            <div className="space-y-4">
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
