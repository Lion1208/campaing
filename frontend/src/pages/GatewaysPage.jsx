import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Eye, EyeOff, Save } from 'lucide-react';
import { toast } from 'sonner';

const AVAILABLE_GATEWAYS = [
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    logo: '💳',
    description: 'Receba pagamentos via PIX com Mercado Pago',
    tokenPlaceholder: 'APP_USR-xxxx-xxxx-xxxx-xxxx',
    helpUrl: 'https://www.mercadopago.com.br/developers/panel/app'
  }
  // Futuros gateways virão aqui
];

export default function GatewaysPage() {
  const { api } = useAuthStore();
  const [gateways, setGateways] = useState({});
  const [loading, setLoading] = useState(true);
  const [showTokens, setShowTokens] = useState({});
  const [saving, setSaving] = useState({});

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      const response = await api.get('/gateways');
      // Converter array para objeto por provider
      const gatewaysMap = {};
      response.data.forEach(gw => {
        gatewaysMap[gw.provider] = gw;
      });
      setGateways(gatewaysMap);
    } catch (error) {
      toast.error('Erro ao carregar gateways');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (provider, enabled) => {
    const current = gateways[provider];
    
    if (enabled && !current?.access_token) {
      toast.error('Configure o token antes de habilitar');
      return;
    }

    setSaving(prev => ({ ...prev, [provider]: true }));
    
    try {
      if (enabled) {
        await api.post('/gateways', {
          provider,
          access_token: current.access_token,
          active: true
        });
        toast.success('Gateway habilitado!');
      } else {
        await api.post('/gateways', {
          provider,
          access_token: current?.access_token || '',
          active: false
        });
        toast.success('Gateway desabilitado!');
      }
      await fetchGateways();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao atualizar gateway');
    } finally {
      setSaving(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleSaveToken = async (provider, token) => {
    if (!token.trim()) {
      toast.error('Token não pode ser vazio');
      return;
    }

    setSaving(prev => ({ ...prev, [provider]: true }));
    
    try {
      await api.post('/gateways', {
        provider,
        access_token: token,
        active: gateways[provider]?.active || false
      });
      toast.success('Token salvo!');
      await fetchGateways();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar token');
    } finally {
      setSaving(prev => ({ ...prev, [provider]: false }));
    }
  };

  const updateLocalToken = (provider, token) => {
    setGateways(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        access_token: token,
        _localToken: token
      }
    }));
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
        <h1 className="text-3xl font-bold text-foreground">Gateways de Pagamento</h1>
        <p className="text-muted-foreground">Configure seus gateways para receber pagamentos</p>
      </div>

      <div className="grid gap-4">
        {AVAILABLE_GATEWAYS.map((gateway) => {
          const config = gateways[gateway.id] || {};
          const isEnabled = config.active || false;
          const hasToken = !!config.access_token || !!config._localToken;
          const localToken = config._localToken || '';
          
          return (
            <Card key={gateway.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{gateway.logo}</span>
                  <div>
                    <h3 className="font-bold text-lg">{gateway.name}</h3>
                    <p className="text-sm text-muted-foreground">{gateway.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${isEnabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {isEnabled ? 'Habilitado' : 'Desabilitado'}
                  </span>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(gateway.id, checked)}
                    disabled={saving[gateway.id]}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label>Access Token</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <Input
                        type={showTokens[gateway.id] ? 'text' : 'password'}
                        value={localToken}
                        onChange={(e) => updateLocalToken(gateway.id, e.target.value)}
                        placeholder={config.access_token_preview || gateway.tokenPlaceholder}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTokens(prev => ({ ...prev, [gateway.id]: !prev[gateway.id] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showTokens[gateway.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button
                      onClick={() => handleSaveToken(gateway.id, localToken)}
                      disabled={!localToken.trim() || saving[gateway.id]}
                      size="sm"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      Salvar
                    </Button>
                  </div>
                  {config.access_token_preview && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Token atual: {config.access_token_preview}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Obtenha em: <a href={gateway.helpUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{gateway.name} Developers</a>
                  </p>
                </div>
              </div>

              {isEnabled && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-sm text-green-500">
                    ✅ Gateway ativo e pronto para receber pagamentos
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="p-6 border-dashed">
        <div className="text-center text-muted-foreground">
          <p className="text-lg mb-2">🚀 Mais gateways em breve!</p>
          <p className="text-sm">PagSeguro, Stripe, PicPay e outros</p>
        </div>
      </Card>
    </div>
  );
}
