import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { RefreshCw, Server, AlertTriangle, CheckCircle, XCircle, Terminal, Wifi, Database, FolderOpen } from 'lucide-react';
import { api } from '@/store';

export default function LogsPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState({});
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState('all');
  const [lines, setLines] = useState('100');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      if (selectedService === 'all') {
        const response = await api.get(`/admin/logs?lines=${lines}`);
        setLogs(response.data);
      } else {
        const response = await api.get(`/admin/logs/${selectedService}?lines=${lines}`);
        setLogs({ [selectedService]: { error: response.data.content, output: '' } });
      }
    } catch (error) {
      toast.error('Erro ao carregar logs');
    }
  }, [selectedService, lines]);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await api.get('/admin/system-status');
      setSystemStatus(response.data);
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchLogs(), fetchStatus()]);
    setLoading(false);
  }, [fetchLogs, fetchStatus]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAll]);

  // Redirect if not admin
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="font-heading font-semibold text-lg text-foreground mb-2">Acesso Negado</h3>
            <p className="text-muted-foreground text-sm">Apenas administradores podem acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    if (status === 'RUNNING') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'STOPPED') return <XCircle className="w-4 h-4 text-destructive" />;
    return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div data-testid="logs-page" className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground">Logs do Sistema</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitore os serviços em tempo real</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "bg-primary" : "border-border"}
          >
            {autoRefresh ? "Auto: ON" : "Auto: OFF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAll}
            disabled={loading}
            className="border-border"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* System Status */}
      {systemStatus && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              Status do Sistema
            </h3>
            
            {/* Services Status */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              {systemStatus.services?.map((service) => (
                <div
                  key={service.name}
                  className={`p-3 rounded-lg border ${
                    service.status === 'RUNNING' 
                      ? 'bg-green-500/10 border-green-500/20' 
                      : 'bg-destructive/10 border-destructive/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(service.status)}
                    <span className="text-sm font-medium text-foreground capitalize">{service.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{service.info}</p>
                </div>
              ))}
            </div>

            {/* Additional Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                <Wifi className={`w-4 h-4 ${systemStatus.whatsapp_service_ok ? 'text-green-500' : 'text-destructive'}`} />
                <span className="text-muted-foreground">WhatsApp:</span>
                <Badge variant="outline" className={systemStatus.whatsapp_service_ok ? 'status-connected' : 'status-disconnected'}>
                  {systemStatus.whatsapp_service_ok ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">MongoDB:</span>
                <span className="text-foreground text-xs font-mono truncate">{systemStatus.mongo_url}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FolderOpen className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Uploads:</span>
                <Badge variant="outline" className={systemStatus.uploads_exists ? 'status-connected' : 'status-disconnected'}>
                  {systemStatus.uploads_exists ? 'OK' : 'Erro'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={selectedService} onValueChange={setSelectedService}>
          <SelectTrigger className="w-40 bg-muted/50 border-border text-foreground">
            <SelectValue placeholder="Serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="backend">Backend</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="frontend">Frontend</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={lines} onValueChange={setLines}>
          <SelectTrigger className="w-32 bg-muted/50 border-border text-foreground">
            <SelectValue placeholder="Linhas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50 linhas</SelectItem>
            <SelectItem value="100">100 linhas</SelectItem>
            <SelectItem value="200">200 linhas</SelectItem>
            <SelectItem value="500">500 linhas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs */}
      {loading && Object.keys(logs).length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(logs).map(([service, data]) => (
            <Card key={service} className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2 capitalize">
                  <Terminal className="w-4 h-4 text-primary" />
                  {service}
                  {data.error && data.error !== "Sem erros" && (
                    <Badge variant="outline" className="status-failed text-xs">Erros</Badge>
                  )}
                </h3>
                
                {/* Error Logs */}
                {data.error && data.error !== "Sem erros" && (
                  <div className="mb-4">
                    <p className="text-xs text-destructive mb-2 font-medium">Erros:</p>
                    <pre className="bg-destructive/10 text-destructive text-xs p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre-wrap break-all">
                      {data.error}
                    </pre>
                  </div>
                )}
                
                {/* Output Logs */}
                {data.output && data.output !== "Sem saída" && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Saída:</p>
                    <pre className="bg-muted/30 text-foreground text-xs p-3 rounded-lg overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre-wrap break-all">
                      {data.output}
                    </pre>
                  </div>
                )}
                
                {(!data.error || data.error === "Sem erros") && (!data.output || data.output === "Sem saída") && (
                  <p className="text-muted-foreground text-sm italic">Nenhum log disponível</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
