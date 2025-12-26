#!/bin/bash

################################################################################
# NEXUZAP - Script de Desinstalação
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Execute como root: sudo bash uninstall.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  ATENÇÃO: Esta ação irá remover completamente o NexuZap!${NC}"
read -p "Tem certeza? (digite 'SIM' para confirmar): " confirm

if [ "$confirm" != "SIM" ]; then
    echo "Cancelado."
    exit 0
fi

echo -e "${YELLOW}Parando serviços...${NC}"
sudo supervisorctl stop nexuzap:* 2>/dev/null || true

echo -e "${YELLOW}Removendo configuração do Supervisor...${NC}"
sudo rm -f /etc/supervisor/conf.d/nexuzap.conf
sudo supervisorctl reread
sudo supervisorctl update

echo -e "${YELLOW}Removendo arquivos da aplicação...${NC}"
sudo rm -rf /opt/nexuzap

echo -e "${YELLOW}Removendo logs...${NC}"
sudo rm -f /var/log/nexuzap_*.log

echo -e "${YELLOW}Deseja remover o MongoDB? (S/N): ${NC}"
read -p "" remove_mongo

if [ "$remove_mongo" = "S" ] || [ "$remove_mongo" = "s" ]; then
    sudo systemctl stop mongod
    sudo systemctl disable mongod
    sudo apt-get purge -y mongodb-org*
    sudo rm -rf /var/log/mongodb
    sudo rm -rf /var/lib/mongodb
    echo -e "${GREEN}✅ MongoDB removido${NC}"
fi

echo -e "${GREEN}\n✅ NexuZap desinstalado com sucesso!${NC}"