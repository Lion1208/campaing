#!/bin/bash

################################################################################
# NEXUZAP - Instalação Rápida (One-Line Install)
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       🚀 NexuZap - Instalação Rápida VPS         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Execute como root: sudo bash quick_install.sh${NC}"
    exit 1
fi

# Baixar script principal
echo -e "${YELLOW}📥 Baixando instalador...${NC}"
wget -q https://raw.githubusercontent.com/Lion1208/campaing/main/install_vps.sh -O /tmp/install_vps.sh

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao baixar instalador${NC}"
    exit 1
fi

chmod +x /tmp/install_vps.sh

echo -e "${GREEN}✅ Instalador baixado${NC}"
echo -e "${YELLOW}🚀 Iniciando instalação...${NC}"
echo ""

/tmp/install_vps.sh

rm -f /tmp/install_vps.sh

echo -e "${GREEN}\n✅ Instalação concluída!${NC}"