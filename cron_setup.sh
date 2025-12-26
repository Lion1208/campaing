#!/bin/bash

################################################################################
# NEXUZAP - Configuração de Tarefas Agendadas (Cron)
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Execute como root: sudo bash cron_setup.sh${NC}"
    exit 1
fi

echo -e "${GREEN}🕐 Configurando tarefas agendadas...${NC}"
echo ""

# Criar arquivo de cron temporário
CRON_FILE="/tmp/nexuzap_cron"

# Adicionar tarefas
cat > "$CRON_FILE" <<EOF
# NexuZap - Tarefas Agendadas

# Backup diário às 2h da manhã
0 2 * * * /opt/nexuzap/backup.sh >> /var/log/nexuzap_backup.log 2>&1

# Health check a cada 5 minutos
*/5 * * * * /opt/nexuzap/health_check.sh >> /var/log/nexuzap_health.log 2>&1

# Limpeza de logs antigos (manter últimos 30 dias) - todo domingo às 3h
0 3 * * 0 find /var/log/nexuzap_*.log -mtime +30 -delete

# Limpeza de uploads antigos (opcional - descomente se necessário)
# 0 4 * * 0 find /opt/nexuzap/backend/uploads -mtime +90 -delete

EOF

# Instalar cron
crontab -l > /tmp/crontab_backup 2>/dev/null || true
cat "$CRON_FILE" >> /tmp/crontab_backup
crontab /tmp/crontab_backup

rm -f "$CRON_FILE" /tmp/crontab_backup

echo -e "${GREEN}✅ Tarefas agendadas configuradas:${NC}"
echo ""
echo "  📦 Backup diário: 02:00"
echo "  💚 Health check: A cada 5 minutos"
echo "  🧹 Limpeza de logs: Domingos 03:00"
echo ""
echo -e "${YELLOW}Ver tarefas: crontab -l${NC}"
echo -e "${YELLOW}Editar tarefas: crontab -e${NC}"
