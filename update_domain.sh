#!/bin/bash

################################################################################
# NEXUZAP - Atualizar Domínio
# Script rápido para trocar o domínio do sistema
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/opt/nexuzap"

log() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[ℹ]${NC} $1"; }

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          🌐 NexuZap - Atualizar Domínio               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    error "Execute como root: sudo bash update_domain.sh"
fi

# Mostrar configuração atual
info "Configuração atual:"
if [ -f "$APP_DIR/frontend/.env" ]; then
    CURRENT_BACKEND=$(grep REACT_APP_BACKEND_URL "$APP_DIR/frontend/.env" | cut -d'=' -f2)
    echo "   Backend URL: $CURRENT_BACKEND"
fi
if [ -f "$APP_DIR/backend/.env" ]; then
    CURRENT_CORS=$(grep CORS_ORIGINS "$APP_DIR/backend/.env" | cut -d'=' -f2)
    echo "   CORS: ${CURRENT_CORS:0:50}..."
fi

echo ""
read -p "Digite o NOVO domínio (ex: nexuzap.top): " NEW_DOMAIN

if [ -z "$NEW_DOMAIN" ]; then
    error "Domínio não pode ser vazio!"
fi

echo ""
info "Novo domínio: $NEW_DOMAIN"
read -p "Confirma a alteração? (s/N): " CONFIRM

if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo "Cancelado."
    exit 0
fi

# Obter IP atual para fallback
CURRENT_IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "localhost")

log "Atualizando backend..."
if [ -f "$APP_DIR/backend/.env" ]; then
    # Backup do .env
    cp "$APP_DIR/backend/.env" "$APP_DIR/backend/.env.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Atualizar CORS_ORIGINS com domínio e IP
    sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=http://${NEW_DOMAIN}:3000,https://${NEW_DOMAIN},http://${NEW_DOMAIN},http://${CURRENT_IP}:3000,http://${CURRENT_IP}:8001,http://localhost:3000|g" "$APP_DIR/backend/.env"
    log "✅ Backend CORS atualizado"
else
    error "Arquivo $APP_DIR/backend/.env não encontrado"
fi

log "Atualizando frontend..."
if [ -f "$APP_DIR/frontend/.env" ]; then
    # Backup do .env
    cp "$APP_DIR/frontend/.env" "$APP_DIR/frontend/.env.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Atualizar REACT_APP_BACKEND_URL
    sed -i "s|REACT_APP_BACKEND_URL=.*|REACT_APP_BACKEND_URL=http://${NEW_DOMAIN}:8001|g" "$APP_DIR/frontend/.env"
    log "✅ Frontend URL atualizada"
else
    error "Arquivo $APP_DIR/frontend/.env não encontrado"
fi

log "Reiniciando serviços..."
supervisorctl restart nexuzap:* >/dev/null 2>&1
sleep 5

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Domínio atualizado com sucesso!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}🌐 Nova configuração:${NC}"
echo "   Frontend: http://${NEW_DOMAIN}:3000"
echo "   Backend:  http://${NEW_DOMAIN}:8001"
echo ""
echo -e "${YELLOW}📌 Não esqueça de configurar DNS:${NC}"
echo "   Tipo A → ${NEW_DOMAIN} → ${CURRENT_IP}"
echo ""
echo -e "${BLUE}Status dos serviços:${NC}"
supervisorctl status nexuzap:*
echo ""
