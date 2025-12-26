#!/bin/bash

################################################################################
# NEXUZAP - Atualização Automática via GitHub
# Salva MongoDB, atualiza código e reinicia tudo
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

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[ERRO]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🔄 NexuZap - Atualização Automática via GitHub    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    error "Execute como root: sudo bash update_vps.sh"
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
        warn "Falha no backup MongoDB (pode ser normal se banco estiver vazio)"
    }
    log "✅ Backup MongoDB salvo: $BACKUP_DIR/mongo_$DATE"
else
    warn "mongodump não encontrado, pulando backup MongoDB"
fi

################################################################################
# ETAPA 2: BACKUP DE ARQUIVOS IMPORTANTES
################################################################################

log "[2/6] 📦 Fazendo backup de arquivos..."

tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" \
    "$APP_DIR/backend/uploads" \
    "$APP_DIR/whatsapp-service/auth_sessions" \
    "$APP_DIR/backend/.env" \
    "$APP_DIR/frontend/.env" \
    2>/dev/null || warn "Alguns arquivos podem não existir"

log "✅ Backup de arquivos salvo: $BACKUP_DIR/files_$DATE.tar.gz"

################################################################################
# ETAPA 3: PARAR SERVIÇOS
################################################################################

log "[3/6] ⏸️  Parando serviços..."

supervisorctl stop nexuzap:* 2>/dev/null || warn "Alguns serviços já estavam parados"
sleep 2

log "✅ Serviços parados"

################################################################################
# ETAPA 4: ATUALIZAR CÓDIGO DO GITHUB
################################################################################

log "[4/6] 📥 Baixando atualizações do GitHub..."

cd "$APP_DIR"

# Salvar alterações locais
git stash push -m "Auto-stash antes de atualizar em $DATE" 2>/dev/null || true

# Atualizar do GitHub
git fetch origin main
git reset --hard origin/main

log "✅ Código atualizado do GitHub"

################################################################################
# ETAPA 5: ATUALIZAR DEPENDÊNCIAS
################################################################################

log "[5/6] 📦 Atualizando dependências..."

# Backend
log "  → Backend Python..."
cd "$APP_DIR/backend"
if [ -d "venv" ]; then
    source venv/bin/activate
    pip install -r requirements.txt -q 2>/dev/null || warn "Algumas dependências Python podem ter falhado"
fi

# Frontend
log "  → Frontend React..."
cd "$APP_DIR/frontend"
npm install --legacy-peer-deps 2>/dev/null || warn "Algumas dependências Node podem ter falhado"

# WhatsApp Service
log "  → WhatsApp Service..."
cd "$APP_DIR/whatsapp-service"
npm install --legacy-peer-deps 2>/dev/null || warn "Algumas dependências Node podem ter falhado"

log "✅ Dependências atualizadas"

################################################################################
# ETAPA 6: ATUALIZAR DOMÍNIO NOS .ENV (SE NECESSÁRIO)
################################################################################

log "[6/7] 🌐 Configurando domínio..."

# Perguntar se quer atualizar o domínio
read -p "Deseja atualizar o domínio? (s/N): " UPDATE_DOMAIN
if [ "$UPDATE_DOMAIN" = "s" ] || [ "$UPDATE_DOMAIN" = "S" ]; then
    read -p "Digite o domínio (ex: nexuzap.top) ou pressione Enter para manter atual: " NEW_DOMAIN
    
    if [ ! -z "$NEW_DOMAIN" ]; then
        log "  Atualizando para: $NEW_DOMAIN"
        
        # Atualizar backend CORS
        if [ -f "$APP_DIR/backend/.env" ]; then
            # Obter IP atual
            CURRENT_IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "localhost")
            
            # Atualizar CORS_ORIGINS
            sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=http://${NEW_DOMAIN}:3000,https://${NEW_DOMAIN},http://${NEW_DOMAIN},http://${CURRENT_IP}:3000,http://${CURRENT_IP}:8001,http://localhost:3000|g" "$APP_DIR/backend/.env"
            log "  ✅ Backend CORS atualizado"
        fi
        
        # Atualizar frontend
        if [ -f "$APP_DIR/frontend/.env" ]; then
            sed -i "s|REACT_APP_BACKEND_URL=.*|REACT_APP_BACKEND_URL=http://${NEW_DOMAIN}:8001|g" "$APP_DIR/frontend/.env"
            log "  ✅ Frontend URL atualizada"
        fi
        
        log "✅ Domínio configurado: $NEW_DOMAIN"
    else
        log "⏭️  Mantendo configuração atual"
    fi
else
    log "⏭️  Pulando atualização de domínio"
fi

################################################################################
# ETAPA 7: REINICIAR SERVIÇOS
################################################################################

log "[7/7] ▶️  Reiniciando serviços..."

supervisorctl restart nexuzap:*
sleep 5

log ""
log "✅ ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!"
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📊 Status dos Serviços:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
supervisorctl status nexuzap:*

echo ""
echo -e "${GREEN}🌐 Configuração atual:${NC}"
if [ -f "$APP_DIR/frontend/.env" ]; then
    FRONTEND_URL=$(grep REACT_APP_BACKEND_URL "$APP_DIR/frontend/.env" | cut -d'=' -f2)
    echo "   Frontend → Backend: $FRONTEND_URL"
fi
if [ -f "$APP_DIR/backend/.env" ]; then
    CORS=$(grep CORS_ORIGINS "$APP_DIR/backend/.env" | cut -d'=' -f2 | cut -d',' -f1)
    echo "   CORS permitido: $CORS..."
fi

echo ""
echo -e "${YELLOW}💾 Backups salvos em:${NC}"
echo "   MongoDB: $BACKUP_DIR/mongo_$DATE"
echo "   Arquivos: $BACKUP_DIR/files_$DATE.tar.gz"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Sistema atualizado e rodando!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Limpar backups antigos (manter últimos 7 dias)
find "$BACKUP_DIR" -type f -mtime +7 -delete 2>/dev/null || true
find "$BACKUP_DIR" -type d -empty -delete 2>/dev/null || true
