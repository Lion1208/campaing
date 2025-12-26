#!/bin/bash

################################################################################
# NEXUZAP - Script de Update/Atualização
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/opt/nexuzap"

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Execute como root: sudo bash update.sh${NC}"
    exit 1
fi

if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}NexuZap não encontrado em $APP_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        NexuZap - Atualização do Sistema         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}[1/6] Parando serviços...${NC}"
sudo supervisorctl stop nexuzap:*

echo -e "${YELLOW}[2/6] Fazendo backup...${NC}"
BACKUP_DIR="/backup/nexuzap_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r "$APP_DIR" "$BACKUP_DIR/"
echo -e "${GREEN}Backup salvo em: $BACKUP_DIR${NC}"

echo -e "${YELLOW}[3/6] Atualizando código do GitHub...${NC}"
cd "$APP_DIR"
git fetch origin
git pull origin main

echo -e "${YELLOW}[4/6] Atualizando dependências do backend...${NC}"
cd "$APP_DIR/backend"
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo -e "${YELLOW}[5/6] Atualizando dependências do frontend...${NC}"
cd "$APP_DIR/frontend"
npm install --legacy-peer-deps

cd "$APP_DIR/whatsapp-service"
npm install --legacy-peer-deps

echo -e "${YELLOW}[6/6] Reiniciando serviços...${NC}"
sudo supervisorctl start nexuzap:*
sleep 5
sudo supervisorctl status nexuzap:*

echo -e "${GREEN}\n✅ Atualização concluída com sucesso!${NC}"
echo -e "${GREEN}Backup disponível em: $BACKUP_DIR${NC}"