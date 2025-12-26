import { useEffect, useState, useRef } from 'react';
import { useConnectionsStore, useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Wifi, Trash2, RefreshCw, Smartphone, Loader2, QrCode, Hash } from 'lucide-react';

export default function ConnectionsPage() {
  const { connections, fetchConnections, createConnection, connectWhatsApp, getQRCode, requestPairingCode, refreshGroups, disconnectWhatsApp, deleteConnection, loading } = useConnectionsStore();
  const { user } = useAuthStore();
  const [newConnectionName, setNewConnectionName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [qrData, setQrData] = useState({ qr: null, qrImage: null, status: 'connecting' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncingConnection, setSyncingConnection] = useState(null);
  const pollingRef = useRef(null);
  
  // Estados para pairing code
  const [connectMode, setConnectMode] = useState('qr'); // 'qr' ou 'code'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Poll for QR code
  useEffect(() => {
    if (qrDialogOpen && selectedConnectionId) {
      const poll = async () => {
        try {
          console.log('[DEBUG] Buscando QR para:', selectedConnectionId);
          const result = await getQRCode(selectedConnectionId);
          console.log('[DEBUG] Resultado QR:', {
            status: result.status,
            temQR: !!result.qrImage,
            temQRCode: !!result.qr,
            error: result.error,
            tamanhoQR: result.qrImage?.length || 0
          });
          setQrData(result);
          
          if (result.status === 'connected') {
            console.log('[DEBUG] Conectado! Parando polling.');
            clearInterval(pollingRef.current);
            setQrDialogOpen(false);
            toast.success('WhatsApp conectado com sucesso!');
            fetchConnections();
          }
        } catch (error) {
          console.error('[DEBUG] Erro ao obter QR:', error);
          console.error('[DEBUG] Detalhes do erro:', error.response?.data || error.message);
        }
      };

      poll();
      pollingRef.current = setInterval(poll, 1500);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [qrDialogOpen, selectedConnectionId, getQRCode, fetchConnections]);

  const handleCreateConnection = async () => {
    if (!newConnectionName.trim()) {
      toast.error('Digite um nome para a conexão');
      return;
    }

    setActionLoading(true);
    try {
      await createConnection(newConnectionName.trim());
      toast.success('Conexão criada com sucesso!');
      setNewConnectionName('');
      setCreateDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar conexão');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnect = async (connection) => {
    console.log('[DEBUG] handleConnect iniciado para:', connection.id, connection.name);
    setSelectedConnectionId(connection.id);
    setQrData({ qr: null, qrImage: null, status: 'connecting' });
    setQrDialogOpen(true);
    
    try {
      console.log('[DEBUG] Chamando connectWhatsApp...');
      const result = await connectWhatsApp(connection.id);
      console.log('[DEBUG] Resultado do connectWhatsApp:', result);
    } catch (error) {
      console.error('[DEBUG] ERRO no connectWhatsApp:', error);
      console.error('[DEBUG] Detalhes:', error.response?.data || error.message);
    }
  };

  const handleRefreshGroups = async (connection) => {
    setSyncingConnection(connection.id);
    try {
      const result = await refreshGroups(connection.id);
      toast.success(`${result.count} grupos sincronizados`);
    } catch (error) {
      toast.error('Erro ao sincronizar');
    } finally {
      setSyncingConnection(null);
    }
  };

  const handleDisconnect = async (connection) => {
    setActionLoading(true);
    try {
      await disconnectWhatsApp(connection.id);
      toast.success('Desconectado com sucesso');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao desconectar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!connectionToDelete) return;
    setActionLoading(true);
    try {
      await deleteConnection(connectionToDelete.id);
      toast.success('Conexão deletada');
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao deletar');
    } finally {
      setActionLoading(false);
    }
  };

  const closeQRDialog = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    setQrDialogOpen(false);
    setSelectedConnectionId(null);
    setQrData({ qr: null, qrImage: null, status: 'connecting' });
    setConnectMode('qr');
    setPhoneNumber('');
    setPairingCode(null);
  };

  const handleRequestPairingCode = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Digite o número do WhatsApp');
      return;
    }
    
    setPairingLoading(true);
    try {
      const result = await requestPairingCode(selectedConnectionId, phoneNumber);
      if (result.success) {
        setPairingCode(result.code);
        toast.success('Código gerado! Digite no seu WhatsApp');
      } else {
        toast.error(result.error || 'Erro ao gerar código');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao gerar código');
    } finally {
      setPairingLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      connected: { class: 'status-connected', label: 'Conectado' },
      connecting: { class: 'status-connecting', label: 'Conectando' },
      waiting_qr: { class: 'status-connecting', label: 'Aguardando QR' },
      waiting_code: { class: 'status-connecting', label: 'Aguardando Código' },
      reconnecting: { class: 'status-connecting', label: 'Reconectando' },
      disconnected: { class: 'status-disconnected', label: 'Desconectado' },
    };
    const c = config[status] || config.disconnected;
    return (
      <Badge variant="outline" className={`${c.class} text-[10px] uppercase tracking-wider`}>
        {c.label}
      </Badge>
    );
  };

  const getQRStatusMessage = () => {
    switch (qrData.status) {
      case 'preparing':
        return { icon: Loader2, text: 'Preparando...', animate: true };
      case 'connecting':
        return { icon: Loader2, text: 'Gerando QR Code...', animate: true };
      case 'waiting_qr':
        return { icon: Loader2, text: 'Carregando...', animate: true };
      default:
        return { icon: Loader2, text: 'Processando...', animate: true };
    }
  };

  const maxConnections = user?.max_connections === -1 ? 'Ilimitadas' : user?.max_connections;
  const canCreateMore = user?.role === 'admin' || connections.length < user?.max_connections;

  return (
    <div data-testid="connections-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Conexões WhatsApp</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {connections.length} de {maxConnections} conexões
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="create-connection-btn"
              disabled={!canCreateMore}
              className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Conexão
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border mx-4 max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground">Nova Conexão</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Dê um nome para identificar esta conexão.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-foreground">Nome da Conexão</Label>
                <Input
                  data-testid="connection-name-input"
                  placeholder="Ex: Marketing, Vendas..."
                  value={newConnectionName}
                  onChange={(e) => setNewConnectionName(e.target.value)}
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <Button
                data-testid="confirm-create-connection"
                onClick={handleCreateConnection}
                disabled={actionLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {actionLoading ? 'Criando...' : 'Criar Conexão'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connections Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : connections.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Wifi className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">
              Nenhuma conexão
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              Crie sua primeira conexão para começar
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-primary text-primary-foreground">
              Criar Conexão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {connections.map((connection, index) => (
            <Card
              key={connection.id}
              data-testid={`connection-card-${connection.id}`}
              className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      connection.status === 'connected' ? 'bg-primary/15 animate-pulse-green' : 'bg-muted/50'
                    }`}>
                      <Wifi className={`w-5 h-5 ${connection.status === 'connected' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{connection.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {connection.phone_number || 'Aguardando conexão'}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(connection.status)}
                </div>

                <div className="text-xs text-muted-foreground mb-4">
                  Criado em {new Date(connection.created_at).toLocaleDateString('pt-BR')}
                </div>

                <div className="flex gap-2">
                  {connection.status === 'disconnected' && (
                    <Button
                      data-testid={`connect-btn-${connection.id}`}
                      onClick={() => handleConnect(connection)}
                      disabled={actionLoading}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      size="sm"
                    >
                      Conectar
                    </Button>
                  )}
                  {connection.status === 'connected' && (
                    <>
                      <Button
                        onClick={() => handleRefreshGroups(connection)}
                        disabled={syncingConnection === connection.id}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-border text-foreground hover:bg-muted/50"
                      >
                        {syncingConnection === connection.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Sincronizando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1.5" />
                            Grupos
                          </>
                        )}
                      </Button>
                      <Button
                        data-testid={`disconnect-btn-${connection.id}`}
                        onClick={() => handleDisconnect(connection)}
                        variant="outline"
                        size="sm"
                        className="border-border text-foreground hover:bg-muted/50"
                      >
                        Desconectar
                      </Button>
                    </>
                  )}
                  <Button
                    data-testid={`delete-btn-${connection.id}`}
                    onClick={() => {
                      setConnectionToDelete(connection);
                      setDeleteDialogOpen(true);
                    }}
                    variant="outline"
                    size="icon"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code / Pairing Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={closeQRDialog}>
        <DialogContent className="glass-card border-border mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Escolha como deseja conectar
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={connectMode} onValueChange={setConnectMode} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="qr" className="flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                QR Code
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Código
              </TabsTrigger>
            </TabsList>
            
            {/* QR Code Tab */}
            <TabsContent value="qr" className="mt-0">
              <div className="flex flex-col items-center py-2">
                {qrData.qrImage ? (
                  <div className="p-3 bg-white rounded-xl shadow-lg animate-fade-in">
                    <img src={qrData.qrImage} alt="QR Code WhatsApp" className="w-52 h-52" />
                  </div>
                ) : (
                  <div className="w-52 h-52 bg-muted/50 rounded-xl flex items-center justify-center border border-border">
                    <div className="text-center space-y-3">
                      <div className="relative">
                        <div className="w-10 h-10 border-3 border-primary/30 rounded-full mx-auto" />
                        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-1/2 -translate-x-1/2" />
                      </div>
                      <p className="text-sm text-muted-foreground">Gerando QR...</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  WhatsApp → Configurações → Aparelhos conectados
                </p>
              </div>
            </TabsContent>
            
            {/* Pairing Code Tab */}
            <TabsContent value="code" className="mt-0">
              <div className="space-y-4 py-2">
                {!pairingCode ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm">Número do WhatsApp</Label>
                      <Input
                        id="phone"
                        placeholder="Ex: 11999999999"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="bg-muted/50 border-border"
                      />
                      <p className="text-xs text-muted-foreground">
                        Digite apenas números, com DDD
                      </p>
                    </div>
                    <Button
                      onClick={handleRequestPairingCode}
                      disabled={pairingLoading || !phoneNumber.trim()}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {pairingLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Gerando código...
                        </>
                      ) : (
                        'Gerar Código'
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="text-center space-y-4">
                    <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-2">Digite este código no WhatsApp:</p>
                      <p className="text-3xl font-mono font-bold text-primary tracking-widest">
                        {pairingCode}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>1. Abra o WhatsApp no celular</p>
                      <p>2. Vá em Configurações → Aparelhos conectados</p>
                      <p>3. Toque em "Conectar um aparelho"</p>
                      <p>4. Escolha "Conectar com número de telefone"</p>
                      <p>5. Digite o código acima</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => { setPairingCode(null); setPhoneNumber(''); }}
                      className="w-full"
                    >
                      Gerar novo código
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-border mx-4 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deletar Conexão</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar "{connectionToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-connection"
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Deletando...' : 'Deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
