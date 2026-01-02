import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function ExpirationWarning() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [daysRemaining, setDaysRemaining] = useState(null);

  useEffect(() => {
    checkExpiration();
  }, [user]);

  const checkExpiration = () => {
    if (!user?.expires_at || user.role === 'admin') return;

    const expirationDate = new Date(user.expires_at);
    const now = new Date();
    const diff = expirationDate - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    // Mostrar aviso se faltam 7 dias ou menos (e ainda não expirou)
    if (days > 0 && days <= 7) {
      setDaysRemaining(days);
    }
  };

  if (!daysRemaining) return null;

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-500">
            Sua conta expira em {daysRemaining} dia{daysRemaining > 1 ? 's' : ''}!
          </p>
          <p className="text-xs text-yellow-600 mt-1">
            Renove agora para não perder o acesso ao sistema.
          </p>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          className="border-yellow-500 text-yellow-500 hover:bg-yellow-500/10"
          onClick={() => {
            // Abrir página de financeiro ou iniciar renovação direta
            if (user.role === 'master' || user.role === 'admin') {
              navigate('/financial');
            } else {
              // Para revendedores, mostrar opção de renovação
              window.location.href = '/financial';
            }
          }}
        >
          Renovar
        </Button>
      </div>
    </div>
  );
}
