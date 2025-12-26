#!/bin/bash

################################################################################
# NEXUZAP - Script de Instalação Completo para VPS
# Sistema 100% automatizado e blindado contra erros
################################################################################

set -e  # Para na primeira falha

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
APP_DIR="/opt/nexuzap"
LOG_FILE="/var/log/nexuzap_install.log"
ERROR_LOG="/var/log/nexuzap_errors.log"

# Função de log
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERRO $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$ERROR_LOG"
}

warn() {
    echo -e "${YELLOW}[AVISO]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Função para retry de comandos
retry() {
    local max_attempts=3
    local delay=5
    local attempt=1
    local cmd="$@"
    
    until $cmd; do
        if [ $attempt -eq $max_attempts ]; then
            error "Comando falhou após $max_attempts tentativas: $cmd"
            return 1
        fi
        warn "Tentativa $attempt falhou. Tentando novamente em ${delay}s..."
        sleep $delay
        attempt=$((attempt + 1))
    done
    return 0
}

# Banner
clear
echo "="=================================================================""
echo "          🚀 NEXUZAP - Instalação Automatizada VPS"
echo "="=================================================================""
echo ""

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
    error "Este script precisa ser executado como root (use sudo)"
    exit 1
fi

log "Iniciando instalação do NexuZap..."

################################################################################
# ETAPA 1: ATUALIZAÇÃO DO SISTEMA
################################################################################

log "[1/12] Atualizando sistema..."
export DEBIAN_FRONTEND=noninteractive

retry apt-get update -qq
retry apt-get upgrade -y -qq
retry apt-get install -y -qq \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    supervisor \
    nginx \
    htop \
    unzip \
    jq \
    lsof || {
    error "Falha ao instalar dependências do sistema"
    exit 1
}

log "✅ Sistema atualizado"

################################################################################
# ETAPA 2: INSTALAÇÃO DO PYTHON 3.11
################################################################################

log "[2/12] Instalando Python 3.11..."

if ! command_exists python3.11; then
    retry apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip || {
        warn "Instalação direta falhou, tentando via deadsnakes PPA..."
        add-apt-repository ppa:deadsnakes/ppa -y
        apt-get update -qq
        apt-get install -y -qq python3.11 python3.11-venv python3.11-dev
    }
else
    log "Python 3.11 já instalado"
fi

# Configurar python3 para apontar para python3.11
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

log "✅ Python 3.11 instalado: $(python3 --version)"

################################################################################
# ETAPA 3: INSTALAÇÃO DO NODE.JS 20
################################################################################

log "[3/12] Instalando Node.js 20..."

if ! command_exists node || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - || {
        error "Falha ao adicionar repositório do Node.js"
        exit 1
    }
    retry apt-get install -y -qq nodejs || {
        error "Falha ao instalar Node.js"
        exit 1
    }
else
    log "Node.js já instalado"
fi

log "✅ Node.js instalado: $(node -v)"
log "✅ NPM instalado: $(npm -v)"

################################################################################
# ETAPA 4: INSTALAÇÃO DO MONGODB
################################################################################

log "[4/12] Instalando MongoDB..."

if ! command_exists mongod; then
    # Importar chave pública
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor || {
        error "Falha ao importar chave do MongoDB"
        exit 1
    }
    
    # Adicionar repositório
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
        tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    retry apt-get update -qq
    retry apt-get install -y -qq mongodb-org || {
        error "Falha ao instalar MongoDB"
        exit 1
    }
    
    # Iniciar e habilitar MongoDB
    systemctl start mongod
    systemctl enable mongod
    
    # Aguardar MongoDB iniciar
    sleep 5
else
    log "MongoDB já instalado"
fi

log "✅ MongoDB instalado e rodando"

################################################################################
# ETAPA 5: CLONAR REPOSITÓRIO
################################################################################

log "[5/12] Clonando repositório..."

if [ -d "$APP_DIR" ]; then
    warn "Diretório $APP_DIR já existe. Fazendo backup..."
    mv "$APP_DIR" "${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
fi

mkdir -p "$APP_DIR"
cd /tmp

retry git clone https://github.com/Lion1208/campaing.git nexuzap_temp || {
    error "Falha ao clonar repositório"
    exit 1
}

cp -r nexuzap_temp/* "$APP_DIR/"
rm -rf nexuzap_temp

log "✅ Repositório clonado"

################################################################################
# ETAPA 6: CONFIGURAÇÃO DE VARIÁVEIS DE AMBIENTE
################################################################################

log "[6/12] Configurando variáveis de ambiente..."

# Solicitar configurações do usuário
info "\n📝 Configuração do Sistema:\n"

read -p "Digite seu domínio (ex: nexuzap.com) ou pressione Enter para usar IP: " DOMAIN
if [ -z "$DOMAIN" ]; then
    DOMAIN=$(curl -s ifconfig.me)
    warn "Usando IP público: $DOMAIN"
fi

read -p "Digite a porta do backend (padrão: 8001): " BACKEND_PORT
BACKEND_PORT=${BACKEND_PORT:-8001}

read -p "Digite a porta do frontend (padrão: 3000): " FRONTEND_PORT
FRONTEND_PORT=${FRONTEND_PORT:-3000}

read -p "Digite a porta do WhatsApp Service (padrão: 3002): " WHATSAPP_PORT
WHATSAPP_PORT=${WHATSAPP_PORT:-3002}

# Backend .env
cat > "$APP_DIR/backend/.env" <<EOF
WHATSAPP_SERVICE_URL=http://127.0.0.1:${WHATSAPP_PORT}
MONGO_URL="mongodb://localhost:27017"
DB_NAME="nexuzap_production"
CORS_ORIGINS=http://${DOMAIN},https://${DOMAIN},http://localhost:${FRONTEND_PORT}
JWT_SECRET=$(openssl rand -hex 32)
EOF

# Frontend .env
cat > "$APP_DIR/frontend/.env" <<EOF
REACT_APP_BACKEND_URL=http://${DOMAIN}:${BACKEND_PORT}
PORT=${FRONTEND_PORT}
EOF

log "✅ Variáveis de ambiente configuradas"

################################################################################
# ETAPA 7: INSTALAÇÃO DE DEPENDÊNCIAS DO BACKEND
################################################################################

log "[7/12] Instalando dependências do backend..."

cd "$APP_DIR/backend"

# Criar ambiente virtual
python3 -m venv venv || {
    error "Falha ao criar ambiente virtual"
    exit 1
}

source venv/bin/activate

# Atualizar pip
pip install --upgrade pip setuptools wheel -q

# Instalar dependências
retry pip install -r requirements.txt -q || {
    error "Falha ao instalar dependências do backend"
    exit 1
}

log "✅ Dependências do backend instaladas"

################################################################################
# ETAPA 8: INSTALAÇÃO DE DEPENDÊNCIAS DO FRONTEND
################################################################################

log "[8/12] Instalando dependências do frontend..."

cd "$APP_DIR/frontend"

retry npm install --legacy-peer-deps || {
    error "Falha ao instalar dependências do frontend"
    exit 1
}

log "✅ Dependências do frontend instaladas"

################################################################################
# ETAPA 9: INSTALAÇÃO DE DEPENDÊNCIAS DO WHATSAPP SERVICE
################################################################################

log "[9/12] Instalando dependências do WhatsApp Service..."

cd "$APP_DIR/whatsapp-service"

retry npm install --legacy-peer-deps || {
    error "Falha ao instalar dependências do WhatsApp Service"
    exit 1
}

mkdir -p auth_sessions
chown -R www-data:www-data auth_sessions

log "✅ Dependências do WhatsApp Service instaladas"

################################################################################
# ETAPA 10: CONFIGURAÇÃO DO SUPERVISOR
################################################################################

log "[10/12] Configurando Supervisor..."

cat > /etc/supervisor/conf.d/nexuzap.conf <<EOF
[program:nexuzap-backend]
command=$APP_DIR/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port ${BACKEND_PORT}
directory=$APP_DIR/backend
user=root
autostart=true
autorestart=true
stdout_logfile=/var/log/nexuzap_backend.log
stderr_logfile=/var/log/nexuzap_backend_error.log
environment=PATH="$APP_DIR/backend/venv/bin"

[program:nexuzap-whatsapp]
command=/usr/bin/node index.js
directory=$APP_DIR/whatsapp-service
user=root
autostart=true
autorestart=true
stdout_logfile=/var/log/nexuzap_whatsapp.log
stderr_logfile=/var/log/nexuzap_whatsapp_error.log
environment=PORT="${WHATSAPP_PORT}"

[program:nexuzap-frontend]
command=/usr/bin/npm start
directory=$APP_DIR/frontend
user=root
autostart=true
autorestart=true
stdout_logfile=/var/log/nexuzap_frontend.log
stderr_logfile=/var/log/nexuzap_frontend_error.log
environment=PORT="${FRONTEND_PORT}"

[group:nexuzap]
programs=nexuzap-backend,nexuzap-whatsapp,nexuzap-frontend
EOF

supervisorctl reread
supervisorctl update

log "✅ Supervisor configurado"

################################################################################
# ETAPA 11: CONFIGURAÇÃO DO FIREWALL
################################################################################

log "[11/12] Configurando firewall..."

ufw --force enable
ufw allow ssh
ufw allow ${BACKEND_PORT}/tcp
ufw allow ${FRONTEND_PORT}/tcp
ufw allow 80/tcp
ufw allow 443/tcp

log "✅ Firewall configurado"

################################################################################
# ETAPA 12: INICIAR SERVIÇOS
################################################################################

log "[12/12] Iniciando serviços..."

sleep 3
supervisorctl start nexuzap:*

# Aguardar serviços iniciarem
sleep 10

log "✅ Serviços iniciados"

################################################################################
# VERIFICAÇÃO FINAL
################################################################################

log "\n🔍 Verificando serviços..."

supervisorctl status nexuzap:*

log "\n✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
info "\n═══════════════════════════════════════════════════════"
info "📱 NEXUZAP instalado e rodando!"
info "═══════════════════════════════════════════════════════"
info ""
info "🌐 Frontend: http://${DOMAIN}:${FRONTEND_PORT}"
info "🔧 Backend:  http://${DOMAIN}:${BACKEND_PORT}"
info ""
info "👤 Usuário padrão: admin"
info "🔑 Senha padrão: admin123"
info ""
info "📊 Gerenciar serviços:"
info "   sudo supervisorctl status nexuzap:*"
info "   sudo supervisorctl restart nexuzap:*"
info ""
info "📝 Logs em:"
info "   /var/log/nexuzap_backend.log"
info "   /var/log/nexuzap_whatsapp.log"
info "   /var/log/nexuzap_frontend.log"
info "═══════════════════════════════════════════════════════"
info ""

log "Instalação finalizada em $(date)"