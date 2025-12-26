import { useState, useEffect } from "react";
import { Package, CheckCircle, XCircle, Loader2, Play, RefreshCw, Terminal, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DependenciesPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installLogs, setInstallLogs] = useState([]);
  const [startingService, setStartingService] = useState(false);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem("nexus-token");
      const response = await fetch(`${API_URL}/admin/dependencies/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("Erro ao buscar status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll status every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleInstallNode = async () => {
    setInstalling(true);
    setInstallLogs(["Iniciando instalação do Node.js..."]);
    
    try {
      const token = localStorage.getItem("nexus-token");
      const response = await fetch(`${API_URL}/admin/dependencies/install-node`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setInstallLogs(prev => [...prev, ...data.logs, "✅ Instalação concluída!"]);
        toast.success("Node.js instalado com sucesso!");
        fetchStatus();
      } else {
        setInstallLogs(prev => [...prev, `❌ Erro: ${data.detail || data.error}`]);
        toast.error(data.detail || "Erro na instalação");
      }
    } catch (error) {
      setInstallLogs(prev => [...prev, `❌ Erro: ${error.message}`]);
      toast.error("Erro ao instalar Node.js");
    } finally {
      setInstalling(false);
    }
  };

  const handleInstallWhatsAppDeps = async () => {
    setInstalling(true);
    setInstallLogs(["Instalando dependências do WhatsApp Service..."]);
    
    try {
      const token = localStorage.getItem("nexus-token");
      const response = await fetch(`${API_URL}/admin/dependencies/install-whatsapp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setInstallLogs(prev => [...prev, ...data.logs, "✅ Dependências instaladas!"]);
        toast.success("Dependências do WhatsApp instaladas!");
        fetchStatus();
      } else {
        setInstallLogs(prev => [...prev, `❌ Erro: ${data.detail || data.error}`]);
        toast.error(data.detail || "Erro na instalação");
      }
    } catch (error) {
      setInstallLogs(prev => [...prev, `❌ Erro: ${error.message}`]);
      toast.error("Erro ao instalar dependências");
    } finally {
      setInstalling(false);
    }
  };

  const handleStartWhatsAppService = async () => {
    setStartingService(true);
    
    try {
      const token = localStorage.getItem("nexus-token");
      const response = await fetch(`${API_URL}/admin/dependencies/start-whatsapp`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success("Serviço WhatsApp iniciado!");
        setInstallLogs(prev => [...prev, "✅ Serviço WhatsApp iniciado!"]);
        fetchStatus();
      } else {
        toast.error(data.detail || "Erro ao iniciar serviço");
      }
    } catch (error) {
      toast.error("Erro ao iniciar serviço");
    } finally {
      setStartingService(false);
    }
  };

  const handleFullSetup = async () => {
    setInstalling(true);
    setInstallLogs(["🚀 Iniciando setup completo..."]);
    
    try {
      const token = localStorage.getItem("nexus-token");
      const response = await fetch(`${API_URL}/admin/dependencies/full-setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setInstallLogs(prev => [...prev, ...data.logs, "✅ Setup completo finalizado!"]);
        toast.success("Setup completo realizado com sucesso!");
        fetchStatus();
      } else {
        setInstallLogs(prev => [...prev, `❌ Erro: ${data.detail || data.error}`]);
        toast.error(data.detail || "Erro no setup");
      }
    } catch (error) {
      setInstallLogs(prev => [...prev, `❌ Erro: ${error.message}`]);
      toast.error("Erro no setup completo");
    } finally {
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const allReady = status?.node_installed && status?.npm_installed && status?.whatsapp_deps_installed && status?.whatsapp_service_running;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dependências do Sistema</h1>
          <p className="text-muted-foreground">Gerencie as dependências necessárias para o funcionamento do WhatsApp</p>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Warning Banner */}
      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-yellow-500">Importante</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Em ambientes de container (como produção), as dependências instaladas podem ser perdidas ao reiniciar. 
              O sistema tentará reinstalar automaticamente no startup, mas pode demorar alguns segundos.
            </p>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Node.js */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Node.js</span>
            {status?.node_installed ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <p className="text-lg font-semibold text-foreground">
            {status?.node_installed ? status?.node_version || "Instalado" : "Não instalado"}
          </p>
        </div>

        {/* NPM */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">NPM</span>
            {status?.npm_installed ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <p className="text-lg font-semibold text-foreground">
            {status?.npm_installed ? status?.npm_version || "Instalado" : "Não instalado"}
          </p>
        </div>

        {/* WhatsApp Deps */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">WhatsApp Deps</span>
            {status?.whatsapp_deps_installed ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <p className="text-lg font-semibold text-foreground">
            {status?.whatsapp_deps_installed ? "Instalado" : "Não instalado"}
          </p>
        </div>

        {/* WhatsApp Service */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Serviço WhatsApp</span>
            {status?.whatsapp_service_running ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <p className="text-lg font-semibold text-foreground">
            {status?.whatsapp_service_running ? "Rodando" : "Parado"}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-6 rounded-xl bg-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Ações</h2>
        
        {allReady ? (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <div>
                <p className="font-medium text-green-500">Sistema pronto!</p>
                <p className="text-sm text-muted-foreground">Todas as dependências estão instaladas e o serviço está rodando.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Full Setup Button */}
            <button
              onClick={handleFullSetup}
              disabled={installing || allReady}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {installing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Instalando...
                </>
              ) : (
                <>
                  <Package className="w-5 h-5" />
                  Setup Completo (Recomendado)
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-card text-muted-foreground">ou instale individualmente</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Install Node */}
              <button
                onClick={handleInstallNode}
                disabled={installing || status?.node_installed}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status?.node_installed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Instalar Node.js
              </button>

              {/* Install WhatsApp Deps */}
              <button
                onClick={handleInstallWhatsAppDeps}
                disabled={installing || !status?.node_installed || status?.whatsapp_deps_installed}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status?.whatsapp_deps_installed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Instalar Deps WhatsApp
              </button>

              {/* Start Service */}
              <button
                onClick={handleStartWhatsAppService}
                disabled={startingService || !status?.whatsapp_deps_installed || status?.whatsapp_service_running}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status?.whatsapp_service_running ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : startingService ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Iniciar Serviço
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Install Logs */}
      {installLogs.length > 0 && (
        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Logs de Instalação</h2>
          </div>
          <div className="bg-black/50 rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto">
            {installLogs.map((log, index) => (
              <div key={index} className="text-green-400">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Info */}
      {status?.system_info && (
        <div className="p-6 rounded-xl bg-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Informações do Sistema</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Plataforma:</span>
              <p className="font-medium">{status.system_info.platform}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Arquitetura:</span>
              <p className="font-medium">{status.system_info.arch}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Python:</span>
              <p className="font-medium">{status.system_info.python_version}</p>
            </div>
            <div>
              <span className="text-muted-foreground">WhatsApp Dir:</span>
              <p className="font-medium">{status.system_info.whatsapp_dir_exists ? "Existe" : "Não existe"}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
