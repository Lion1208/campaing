import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { AlertTriangle, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function RenewalModal() {
  const { api, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    checkExpiration();
  }, [user]);

  const checkExpiration = () => {
    if (!user?.expires_at) return;

    const expirationDate = new Date(user.expires_at);
    const now = new Date();

    // Se expirado, forçar renovação
    if (expirationDate < now && user.role !== 'admin') {
      setOpen(true);
    }
  };

  const handleRenew = async () => {
    try {
      const response = await api.post(`/renew/${user.id}`);
      setPaymentData(response.data);
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
          toast.success('Pagamento confirmado! Sua conta foi renovada.');
          setOpen(false);
          window.location.reload();
        }
      } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
      }
    }, 5000);

    setTimeout(() => {
      clearInterval(interval);
      setCheckingPayment(false);
    }, 600000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !paymentData && setOpen(val)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="w-5 h-5" />
            Renovação Obrigatória
          </DialogTitle>
        </DialogHeader>
        
        {!paymentData ? (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-red-500">
                Sua conta expirou! Para continuar usando o sistema, você precisa renovar agora.
              </p>
            </div>
            
            <Button onClick={handleRenew} className="w-full" size="lg">
              Renovar Agora
            </Button>
          </div>
        ) : (
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
