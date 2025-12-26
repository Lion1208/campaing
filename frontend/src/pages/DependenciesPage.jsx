import { useState, useEffect, useRef } from "react";
import { Package, CheckCircle, XCircle, Loader2, Play, RefreshCw, Terminal, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DependenciesPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installLogs, setInstallLogs] = useState([]);
  const [startingService, setStartingService] = useState(false);
  
  // Terminal state
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [executingCommand, setExecutingCommand] = useState(false);
  const terminalRef = useRef(null);

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

  const handleRestartWhatsApp = async () => {
    setStartingService(true);
    setInstallLogs(["🔄 Reiniciando serviço WhatsApp..."]);
    
    try {
      const token = localStorage.getItem("nexus-token");
      const response = await fetch(`${API_URL}/debug/whatsapp-service/restart`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success("Serviço WhatsApp reiniciado!");
        setInstallLogs(prev => [...prev, "✅ Serviço WhatsApp reiniciado com sucesso!"]);
        fetchStatus();
      } else {
        toast.error(data.message || "Erro ao reiniciar serviço");
        setInstallLogs(prev => [...prev, `⚠️ ${data.message || 'Erro ao reiniciar'}`]);
      }
    } catch (error) {
      toast.error("Erro ao reiniciar serviço");
      setInstallLogs(prev => [...prev, `❌ Erro: ${error.message}`]);
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

  const executeCommand = async () => {
    if (!currentCommand.trim() || executingCommand) return;
    
    const cmd = currentCommand.trim();
    setCurrentCommand('');
    
    // Add command to output
    setTerminalOutput(prev => [...prev, { type: 'command', text: `$ ${cmd}` }]);
    setExecutingCommand(true);
    
    try {
      const token = localStorage.getItem("nexus-token");
      const response = await fetch(`${API_URL}/admin/terminal/execute`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: cmd })
      });
      
      const data = await response.json();
      
      if (data.output) {
        setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
      }
      
      if (data.error) {
        setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
      }
      
      if (!data.success) {
        setTerminalOutput(prev => [...prev, { 
          type: 'error', 
          text: `Comando falhou com código de saída: ${data.exit_code}` 
        }]);
      }
      
    } catch (error) {
      setTerminalOutput(prev => [...prev, { 
        type: 'error', 
        text: `Erro ao executar comando: ${error.message}` 
      }]);
    } finally {
      setExecutingCommand(false);
      // Scroll to bottom
      setTimeout(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  const clearTerminal = () => {
    setTerminalOutput([]);
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

              {/* Restart Service */}
              {status?.whatsapp_service_running && (
                <button
                  onClick={handleRestartWhatsApp}
                  disabled={startingService}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-500 transition-colors"
                >
                  {startingService ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Reiniciar Serviço
                </button>
              )}
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

      {/* Terminal CMD */}
      <div className="p-6 rounded-xl bg-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Terminal do Servidor</h2>
          </div>
          <button
            onClick={clearTerminal}
            className="text-sm px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            Limpar
          </button>
        </div>
        
        <div className="space-y-3">
          {/* Terminal Output */}
          <div 
            ref={terminalRef}
            className="bg-black rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto"
          >
            {terminalOutput.length === 0 ? (
              <div className="text-gray-500">
                <p>Terminal pronto. Digite seus comandos abaixo.</p>
                <p className="mt-2">Exemplos:</p>
                <p className="text-green-400 mt-1">$ ls -la</p>
                <p className="text-green-400">$ pwd</p>
                <p className="text-green-400">$ cat /app/backend/.env</p>
                <p className="text-green-400">$ supervisorctl status</p>
              </div>
            ) : (
              terminalOutput.map((line, index) => (
                <div 
                  key={index} 
                  className={
                    line.type === 'command' 
                      ? 'text-green-400 font-bold mb-1' 
                      : line.type === 'error'
                      ? 'text-red-400 whitespace-pre-wrap mb-2'
                      : 'text-gray-300 whitespace-pre-wrap mb-2'
                  }
                >
                  {line.text}
                </div>
              ))
            )}
            {executingCommand && (
              <div className="text-yellow-400 animate-pulse">Executando...</div>
            )}
          </div>

          {/* Command Input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 font-mono">$</span>
              <input
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={executingCommand}
                placeholder="Digite seu comando aqui..."
                className="w-full pl-8 pr-4 py-3 rounded-lg bg-black border border-border text-white font-mono focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
            <button
              onClick={executeCommand}
              disabled={executingCommand || !currentCommand.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {executingCommand ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <p><strong>⚠️ Atenção:</strong> Você tem acesso root completo ao servidor.</p>
            <p className="mt-1">• Comandos longos podem ter timeout de 30 segundos</p>
            <p>• Para comandos que demoram, use: <code className="text-green-400">nohup comando &</code></p>
            <p>• Diretório atual: <code className="text-green-400">/app</code></p>
          </div>
        </div>
      </div>

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
