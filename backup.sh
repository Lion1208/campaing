#!/bin/bash

################################################################################
# NEXUZAP - Script de Backup
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKUP_DIR="/backup/nexuzap"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/nexuzap"

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Execute como root: sudo bash backup.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Iniciando backup do NexuZap...${NC}"

mkdir -p "$BACKUP_DIR"

# Backup MongoDB
echo -e "${YELLOW}Backup do banco de dados...${NC}"
mongodump --db nexuzap_production --out "$BACKUP_DIR/mongo_$DATE" --quiet

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Banco de dados: $BACKUP_DIR/mongo_$DATE${NC}"
else
    echo -e "${RED}❌ Falha no backup do banco de dados${NC}"
fi

# Backup de arquivos importantes
echo -e "${YELLOW}Backup de arquivos...${NC}"
tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" \
    "$APP_DIR/backend/uploads" \
    "$APP_DIR/whatsapp-service/auth_sessions" \
    "$APP_DIR/backend/.env" \
    "$APP_DIR/frontend/.env" \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Arquivos: $BACKUP_DIR/files_$DATE.tar.gz${NC}"
else
    echo -e "${RED}❌ Falha no backup de arquivos${NC}"
fi

# Backup do código
echo -e "${YELLOW}Backup do código...${NC}"
tar -czf "$BACKUP_DIR/code_$DATE.tar.gz" \
    --exclude="$APP_DIR/*/node_modules" \
    --exclude="$APP_DIR/backend/venv" \
    --exclude="$APP_DIR/*/.git" \
    "$APP_DIR" \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Código: $BACKUP_DIR/code_$DATE.tar.gz${NC}"
else
    echo -e "${RED}❌ Falha no backup do código${NC}"
fi

# Limpar backups antigos (manter apenas últimos 7 dias)
echo -e "${YELLOW}Limpando backups antigos...${NC}"
find "$BACKUP_DIR" -mtime +7 -delete 2>/dev/null

echo -e "${GREEN}\n✅ Backup concluído!${NC}"
echo -e "${GREEN}Localização: $BACKUP_DIR${NC}"
echo ""
echo "Arquivos criados:"
ls -lh "$BACKUP_DIR"/*$DATE* 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'

# Calcular tamanho total
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | awk '{print $1}')
echo ""
echo -e "${YELLOW}Tamanho total dos backups: $TOTAL_SIZE${NC}"