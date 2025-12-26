#!/bin/bash

################################################################################
# NEXUZAP - Configurar Horário de Brasília
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[ℹ]${NC} $1"; }

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🕐 NexuZap - Configurar Horário Brasília        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    error "Execute como root: sudo bash set_timezone.sh"
fi

info "Timezone atual:"
timedatectl | grep "Time zone"

echo ""
log "Configurando timezone para America/Sao_Paulo (Brasília)..."

# Configurar timezone
timedatectl set-timezone America/Sao_Paulo

# Verificar se deu certo
NEW_TZ=$(timedatectl | grep "Time zone" | awk '{print $3}')

if [ "$NEW_TZ" = "America/Sao_Paulo" ]; then
    log "✅ Timezone configurado com sucesso!"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Horário atual do sistema:${NC}"
    date "+%d/%m/%Y %H:%M:%S %Z"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    
    log "Reiniciando serviços NexuZap..."
    supervisorctl restart nexuzap:* >/dev/null 2>&1
    sleep 3
    
    log "✅ Serviços reiniciados com novo timezone!"
    echo ""
    info "Agora todas as campanhas usarão horário de Brasília! 🇧🇷"
else
    error "Falha ao configurar timezone"
fi
