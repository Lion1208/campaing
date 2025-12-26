#!/bin/bash

################################################################################
# NEXUZAP - Script de Restauração de Backup
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_DIR="/backup/nexuzap"
APP_DIR="/opt/nexuzap"

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Execute como root: sudo bash restore.sh${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      NexuZap - Restauração de Backup          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Diretório de backup não encontrado: $BACKUP_DIR${NC}"
    exit 1
fi

# Listar backups disponíveis
echo -e "${YELLOW}Backups disponíveis:${NC}"
echo ""

MONGO_BACKUPS=($(ls -d "$BACKUP_DIR"/mongo_* 2>/dev/null | sort -r))
FILE_BACKUPS=($(ls "$BACKUP_DIR"/files_*.tar.gz 2>/dev/null | sort -r))

if [ ${#MONGO_BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}Nenhum backup encontrado${NC}"
    exit 1
fi

for i in "${!MONGO_BACKUPS[@]}"; do
    BACKUP_NAME=$(basename "${MONGO_BACKUPS[$i]}")
    BACKUP_DATE=$(echo "$BACKUP_NAME" | grep -oP '\d{8}_\d{6}')
    echo -e "  $((i+1)). $BACKUP_DATE"
done

echo ""
read -p "Selecione o backup para restaurar (número): " BACKUP_NUM

if ! [[ "$BACKUP_NUM" =~ ^[0-9]+$ ]] || [ "$BACKUP_NUM" -lt 1 ] || [ "$BACKUP_NUM" -gt "${#MONGO_BACKUPS[@]}" ]; then
    echo -e "${RED}Seleção inválida${NC}"
    exit 1
fi

SELECTED_MONGO="${MONGO_BACKUPS[$((BACKUP_NUM-1))]}"
BACKUP_DATE=$(basename "$SELECTED_MONGO" | grep -oP '\d{8}_\d{6}')
SELECTED_FILES="$BACKUP_DIR/files_$BACKUP_DATE.tar.gz"

echo ""
echo -e "${YELLOW}⚠️  ATENÇÃO: Isso irá sobrescrever os dados atuais!${NC}"
read -p "Tem certeza? (digite 'SIM' para confirmar): " confirm

if [ "$confirm" != "SIM" ]; then
    echo "Cancelado."
    exit 0
fi

echo -e "${YELLOW}Parando serviços...${NC}"
sudo supervisorctl stop nexuzap:*

# Restaurar MongoDB
echo -e "${YELLOW}Restaurando banco de dados...${NC}"
mongorestore --db nexuzap_production --drop "$SELECTED_MONGO/nexuzap_production" --quiet

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Banco de dados restaurado${NC}"
else
    echo -e "${RED}❌ Falha ao restaurar banco de dados${NC}"
fi

# Restaurar arquivos
if [ -f "$SELECTED_FILES" ]; then
    echo -e "${YELLOW}Restaurando arquivos...${NC}"
    tar -xzf "$SELECTED_FILES" -C / 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Arquivos restaurados${NC}"
    else
        echo -e "${RED}❌ Falha ao restaurar arquivos${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Backup de arquivos não encontrado para esta data${NC}"
fi

echo -e "${YELLOW}Reiniciando serviços...${NC}"
sudo supervisorctl start nexuzap:*
sleep 5

echo -e "${GREEN}\n✅ Restauração concluída!${NC}"
sudo supervisorctl status nexuzap:*