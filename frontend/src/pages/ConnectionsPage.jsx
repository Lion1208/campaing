import { useState, useEffect, useRef } from 'react';
import { useConnectionsStore, useAuthStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Wifi, WifiOff, Trash2, RefreshCw, Loader2, Phone } from 'lucide-react';

export default function ConnectionsPage() {
  const { connections, fetchConnections, createConnection, deleteConnection, loading } = useConnectionsStore();
  const { user } = useAuthStore();
  const [newConnectionName, setNewConnectionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  // Estado para QR codes - cada conexão pode ter seu próprio QR
  const [qrStates, setQrStates] = useState({});
  const pollingRefs = useRef({});

  useEffect(() => {
    fetchConnections();
    return () => {
      // Limpar todos os pollings ao desmontar
      Object.values(pollingRefs.current).forEach(clearInterval);
    };
  }, []);

  // Função para buscar QR de uma conexão específica
  const fetchQR = async (connectionId) => {
    try {
      const token = localStorage.getItem('nexus-token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/connections/${connectionId}/qr`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      setQrStates(prev => ({
        ...prev,
        [connectionId]: {
          ...prev[connectionId],
          qrImage: data.qrImage,
          status: data.status,
          phoneNumber: data.phoneNumber,
          loading: false
        }
      }));

      // Se conectou, para o polling e atualiza lista
      if (data.status === 'connected') {
        stopPolling(connectionId);
        fetchConnections();
        toast.success('WhatsApp conectado!');
      }
    } catch (error) {
      console.error('Erro ao buscar QR:', error);
    }
  };

  // Iniciar polling para uma conexão
  const startPolling = (connectionId) => {
    if (pollingRefs.current[connectionId]) {
      clearInterval(pollingRefs.current[connectionId]);
    }
    
    // Busca imediata
    fetchQR(connectionId);
    
    // Polling a cada 2 segundos
    pollingRefs.current[connectionId] = setInterval(() => {
      fetchQR(connectionId);
    }, 2000);
  };

  // Parar polling
  const stopPolling = (connectionId) => {
    if (pollingRefs.current[connectionId]) {
      clearInterval(pollingRefs.current[connectionId]);
      delete pollingRefs.current[connectionId];
    }
  };

  // Conectar WhatsApp - gera QR no card
  const handleConnect = async (connectionId) => {
    setQrStates(prev => ({
      ...prev,
      [connectionId]: { loading: true, qrImage: null, status: 'connecting' }
    }));

    try {
      const token = localStorage.getItem('nexus-token');
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/connections/${connectionId}/connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Inicia polling para buscar QR
      startPolling(connectionId);
    } catch (error) {
      toast.error('Erro ao iniciar conexão');
      setQrStates(prev => ({
        ...prev,
        [connectionId]: { loading: false, status: 'error' }
      }));
    }
  };

  // Cancelar conexão (parar de mostrar QR)
  const handleCancelConnect = (connectionId) => {
    stopPolling(connectionId);
    setQrStates(prev => {
      const newState = { ...prev };
      delete newState[connectionId];
      return newState;
    });
  };

  // Desconectar WhatsApp
  const handleDisconnect = async (connectionId) => {
    try {
      const token = localStorage.getItem('nexus-token');
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/connections/${connectionId}/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Desconectado');
      fetchConnections();
    } catch (error) {
      toast.error('Erro ao desconectar');
    }
  };

  // Criar nova conexão
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newConnectionName.trim()) return;
    
    setCreating(true);
    try {
      await createConnection(newConnectionName.trim());
      setNewConnectionName('');
      toast.success('Conexão criada');
      fetchConnections();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar');
    } finally {
      setCreating(false);
    }
  };

  // Deletar conexão
  const handleDelete = async (connectionId) => {
    setDeletingId(connectionId);
    stopPolling(connectionId);
    try {
      await deleteConnection(connectionId);
      toast.success('Conexão deletada');
    } catch (error) {
      toast.error('Erro ao deletar');
    } finally {
      setDeletingId(null);
    }
  };

  // Sincronizar grupos
  const handleSyncGroups = async (connectionId) => {
    try {
      const token = localStorage.getItem('nexus-token');
      toast.loading('Sincronizando grupos...');
      console.log(`[DEBUG] Sincronizando grupos para: ${connectionId}`);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/connections/${connectionId}/refresh-groups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.dismiss();
      
      const data = await response.json();
      console.log(`[DEBUG] Resposta sync grupos:`, data);
      
      if (response.ok) {
        toast.success(`${data.count || 0} grupos sincronizados!`);
        if (data.count === 0) {
          toast.warning('Nenhum grupo encontrado. Verifique se a conexão está ativa.');
        }
      } else {
        console.error(`[DEBUG] Erro ao sincronizar:`, data);
        toast.error(data.detail || 'Erro ao sincronizar');
      }
      
      fetchConnections();
    } catch (error) {
      toast.dismiss();
      toast.error('Erro ao sincronizar');
    }
  };

  const maxConnections = user?.role === 'admin' ? '∞' : user?.max_connections || 1;
  const canCreateMore = user?.role === 'admin' || connections.length < user?.max_connections;

  const getStatusBadge = (connection) => {
    const qrState = qrStates[connection.id];
    const status = qrState?.status || connection.status;
    
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">Conectado</Badge>;
      case 'connecting':
      case 'waiting_qr':
        return <Badge className="bg-yellow-500">Aguardando QR</Badge>;
      case 'disconnected':
        return <Badge variant="secondary">Desconectado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conexões WhatsApp</h1>
          <p className="text-muted-foreground">
            {connections.length} de {maxConnections} conexões
          </p>
        </div>
        <Button onClick={() => fetchConnections()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Formulário de criação */}
      {canCreateMore && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="flex gap-3">
              <Input
                placeholder="Nome da conexão (ex: WhatsApp Vendas)"
                value={newConnectionName}
                onChange={(e) => setNewConnectionName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={creating || !newConnectionName.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span className="ml-2">Criar</span>
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Lista de conexões */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wifi className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma conexão criada</p>
            <p className="text-sm">Crie sua primeira conexão acima</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((connection) => {
            const qrState = qrStates[connection.id];
            const isConnecting = qrState?.loading || qrState?.status === 'connecting' || qrState?.status === 'waiting_qr';
            const hasQR = qrState?.qrImage;
            const isConnected = connection.status === 'connected' || qrState?.status === 'connected';
            const isDeleting = deletingId === connection.id;

            return (
              <Card key={connection.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg truncate">{connection.name}</CardTitle>
                    {getStatusBadge(connection)}
                  </div>
                  {connection.phone_number && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {connection.phone_number}
                    </p>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* QR Code Area */}
                  {(isConnecting || hasQR) && !isConnected && (
                    <div className="flex flex-col items-center p-4 bg-white rounded-lg">
                      {hasQR ? (
                        <>
                          <img src={qrState.qrImage} alt="QR Code" className="w-48 h-48" />
                          <p className="text-sm text-gray-600 mt-2">Escaneie com o WhatsApp</p>
                        </>
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => handleCancelConnect(connection.id)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}

                  {/* Grupos */}
                  {isConnected && connection.groups_count > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {connection.groups_count} grupos sincronizados
                    </p>
                  )}

                  {/* Botões de ação */}
                  <div className="flex gap-2 flex-wrap">
                    {!isConnected && !isConnecting && (
                      <Button 
                        size="sm" 
                        onClick={() => handleConnect(connection.id)}
                        className="flex-1"
                      >
                        <Wifi className="w-4 h-4 mr-1" />
                        Conectar
                      </Button>
                    )}
                    
                    {isConnected && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSyncGroups(connection.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Sincronizar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDisconnect(connection.id)}
                        >
                          <WifiOff className="w-4 h-4 mr-1" />
                          Desconectar
                        </Button>
                      </>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleDelete(connection.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
