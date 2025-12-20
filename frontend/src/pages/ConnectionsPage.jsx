import { useEffect, useState } from 'react';
import { useConnectionsStore, useAuthStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

export default function ConnectionsPage() {
  const { connections, fetchConnections, createConnection, connectWhatsApp, simulateConnect, disconnectWhatsApp, deleteConnection, loading } = useConnectionsStore();
  const { user } = useAuthStore();
  const [newConnectionName, setNewConnectionName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

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
    setSelectedConnection(connection);
    setActionLoading(true);
    try {
      const result = await connectWhatsApp(connection.id);
      setQrCode(result.qr_code);
      setQrDialogOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao conectar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateConnect = async () => {
    if (!selectedConnection) return;
    setActionLoading(true);
    try {
      await simulateConnect(selectedConnection.id);
      toast.success('Conexão estabelecida com sucesso!');
      setQrDialogOpen(false);
      setQrCode(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao conectar');
    } finally {
      setActionLoading(false);
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

  const getStatusBadge = (status) => {
    const styles = {
      connected: 'status-connected',
      connecting: 'status-connecting',
      disconnected: 'status-disconnected',
    };
    const labels = {
      connected: 'Conectado',
      connecting: 'Conectando',
      disconnected: 'Desconectado',
    };
    return (
      <Badge variant="outline" className={`${styles[status]} font-mono text-[10px] uppercase tracking-wider`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const maxConnections = user?.max_connections === -1 ? 'Ilimitadas' : user?.max_connections;
  const canCreateMore = user?.role === 'admin' || connections.length < user?.max_connections;

  return (
    <div data-testid="connections-page" className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-3xl text-foreground tracking-tight">Conexões WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
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
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova Conexão
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-white/10">
            <DialogHeader>
              <DialogTitle className="font-heading">Criar Nova Conexão</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Dê um nome para identificar esta conexão WhatsApp.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Nome da Conexão
                </Label>
                <Input
                  data-testid="connection-name-input"
                  placeholder="Ex: Marketing, Vendas, etc."
                  value={newConnectionName}
                  onChange={(e) => setNewConnectionName(e.target.value)}
                  className="h-12 bg-black/40 border-white/10"
                />
              </div>
              <Button
                data-testid="confirm-create-connection"
                onClick={handleCreateConnection}
                disabled={actionLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
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
          <div className="animate-pulse text-primary font-mono">Carregando...</div>
        </div>
      ) : connections.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h3 className="font-heading font-semibold text-xl text-foreground mb-2">
              Nenhuma conexão encontrada
            </h3>
            <p className="text-muted-foreground mb-6">
              Crie sua primeira conexão para começar a enviar campanhas
            </p>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
            >
              Criar Primeira Conexão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connections.map((connection, index) => (
            <Card
              key={connection.id}
              data-testid={`connection-card-${connection.id}`}
              className={`glass-card hover-lift animate-fade-in stagger-${(index % 5) + 1}`}
              style={{ opacity: 0 }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      connection.status === 'connected' ? 'bg-primary/10 animate-pulse-green' : 'bg-white/5'
                    }`}>
                      <svg className={`w-6 h-6 ${connection.status === 'connected' ? 'text-primary' : 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <CardTitle className="font-heading font-semibold text-lg">{connection.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {connection.phone_number || 'Aguardando conexão'}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(connection.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Criado em</span>
                  <span className="font-mono text-xs">
                    {new Date(connection.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  {connection.status === 'disconnected' && (
                    <Button
                      data-testid={`connect-btn-${connection.id}`}
                      onClick={() => handleConnect(connection)}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
                    >
                      Conectar
                    </Button>
                  )}
                  {connection.status === 'connected' && (
                    <Button
                      data-testid={`disconnect-btn-${connection.id}`}
                      onClick={() => handleDisconnect(connection)}
                      variant="outline"
                      className="flex-1 border-white/10 hover:bg-white/5"
                    >
                      Desconectar
                    </Button>
                  )}
                  {connection.status === 'connecting' && (
                    <Button
                      onClick={() => {
                        setSelectedConnection(connection);
                        setQrCode(connection.qr_code);
                        setQrDialogOpen(true);
                      }}
                      variant="outline"
                      className="flex-1 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10"
                    >
                      Ver QR Code
                    </Button>
                  )}
                  <Button
                    data-testid={`delete-btn-${connection.id}`}
                    onClick={() => {
                      setConnectionToDelete(connection);
                      setDeleteDialogOpen(true);
                    }}
                    variant="outline"
                    size="icon"
                    className="border-destructive/20 text-destructive hover:bg-destructive/10"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="glass-card border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Conectar WhatsApp</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Escaneie o QR Code com seu WhatsApp para conectar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-8">
            {qrCode && (
              <div className="p-4 bg-white rounded-xl">
                <QRCodeSVG value={qrCode} size={200} />
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4 text-center font-mono">
              Abra o WhatsApp &gt; Dispositivos conectados &gt; Conectar dispositivo
            </p>
            <div className="mt-6 w-full space-y-2">
              <Button
                data-testid="simulate-connect-btn"
                onClick={handleSimulateConnect}
                disabled={actionLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 btn-glow"
              >
                {actionLoading ? 'Conectando...' : 'Simular Conexão (Demo)'}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                Em produção, a conexão acontece automaticamente após escanear
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Deletar Conexão</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja deletar a conexão "{connectionToDelete?.name}"? 
              Esta ação não pode ser desfeita e todos os grupos associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancelar</AlertDialogCancel>
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
