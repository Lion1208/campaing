#!/bin/bash

################################################################################
# NEXUZAP - Atualização Simples (sem git)
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/opt/nexuzap"
BACKUP_DIR="/backup/nexuzap"
DATE=$(date +%Y%m%d_%H%M%S)
GITHUB_RAW="https://raw.githubusercontent.com/Lion1208/campaing/main"

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERRO]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🔄 NexuZap - Atualização Simples (Download)       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    error "Execute como root: sudo bash simple_update.sh"
    exit 1
fi

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"

################################################################################
# ETAPA 1: BACKUP DO MONGODB
################################################################################

log "[1/6] 💾 Fazendo backup do MongoDB..."

if command -v mongodump >/dev/null 2>&1; then
    mongodump --db nexuzap_production --out "$BACKUP_DIR/mongo_$DATE" --quiet 2>/dev/null || {
        warn "Falha no backup MongoDB"
    }
    log "✅ Backup MongoDB salvo: $BACKUP_DIR/mongo_$DATE"
else
    warn "mongodump não encontrado"
fi

################################################################################
# ETAPA 2: BACKUP DE .ENV FILES
################################################################################

log "[2/6] 💾 Fazendo backup das configurações..."

cp "$APP_DIR/backend/.env" "/tmp/backend.env.bak" 2>/dev/null || warn "Backend .env não encontrado"
cp "$APP_DIR/frontend/.env" "/tmp/frontend.env.bak" 2>/dev/null || warn "Frontend .env não encontrado"
cp "$APP_DIR/whatsapp-service/.env" "/tmp/whatsapp.env.bak" 2>/dev/null || warn "WhatsApp .env não encontrado"

log "✅ Configurações salvas"

################################################################################
# ETAPA 3: PARAR SERVIÇOS
################################################################################

log "[3/6] ⏸️  Parando serviços..."

supervisorctl stop nexuzap:* 2>/dev/null || warn "Alguns serviços já estavam parados"
sleep 2

log "✅ Serviços parados"

################################################################################
# ETAPA 4: BAIXAR ARQUIVOS ATUALIZADOS
################################################################################

log "[4/6] 📥 Baixando arquivos do GitHub..."

cd "$APP_DIR"

# Backend
log "  → Atualizando backend/server.py..."
wget -q -O backend/server.py "$GITHUB_RAW/backend/server.py" || error "Falha ao baixar server.py"

# Frontend  
log "  → Atualizando frontend/src/pages/EditCampaignPage.jsx..."
wget -q -O frontend/src/pages/EditCampaignPage.jsx "$GITHUB_RAW/frontend/src/pages/EditCampaignPage.jsx" || error "Falha ao baixar EditCampaignPage.jsx"

# WhatsApp Service
log "  → Atualizando whatsapp-service/index.js..."
wget -q -O whatsapp-service/index.js "$GITHUB_RAW/whatsapp-service/index.js" || error "Falha ao baixar index.js"

log "✅ Arquivos atualizados"

################################################################################
# ETAPA 5: BUILD DO FRONTEND
################################################################################

log "[5/6] 🔨 Compilando frontend (pode demorar ~1 minuto)..."

cd "$APP_DIR/frontend"
npm run build > /tmp/nexuzap_build.log 2>&1 || {
    warn "Erro no build. Ver logs em /tmp/nexuzap_build.log"
}

log "✅ Frontend compilado"

################################################################################
# ETAPA 6: RESTAURAR .ENV E REINICIAR
################################################################################

log "[6/6] 🔧 Restaurando configurações e reiniciando..."

cd "$APP_DIR"

# Restaurar .env
cp /tmp/backend.env.bak "$APP_DIR/backend/.env" 2>/dev/null || true
cp /tmp/frontend.env.bak "$APP_DIR/frontend/.env" 2>/dev/null || true
cp /tmp/whatsapp.env.bak "$APP_DIR/whatsapp-service/.env" 2>/dev/null || true

# Reiniciar serviços
supervisorctl restart nexuzap:*
sleep 5

log ""
log "✅ ATUALIZAÇÃO CONCLUÍDA!"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📊 Status dos Serviços:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
supervisorctl status nexuzap:*

echo ""
echo -e "${GREEN}🎉 Pronto! Limpe o cache do navegador (Ctrl+Shift+Del) e teste em: https://nexuzap.com${NC}"
echo ""
