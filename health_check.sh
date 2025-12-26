#!/bin/bash

################################################################################
# NEXUZAP - Script de Health Check
# Verifica se todos os serviços estão rodando corretamente
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          NexuZap - Health Check                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Função para verificar serviço
check_service() {
    local service=$1
    local port=$2
    
    # Verificar se porta está aberta
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $service (porta $port)${NC}"
        return 0
    else
        echo -e "${RED}❌ $service (porta $port) - NÃO ESTÁ RODANDO${NC}"
        return 1
    fi
}

# Verificar MongoDB
echo "🔍 Verificando serviços..."
echo ""

if systemctl is-active --quiet mongod; then
    echo -e "${GREEN}✅ MongoDB${NC}"
else
    echo -e "${RED}❌ MongoDB - NÃO ESTÁ RODANDO${NC}"
fi

# Verificar serviços NexuZap
check_service "Frontend" 3000
check_service "Backend" 8001
check_service "WhatsApp Service" 3002

echo ""
echo "📊 Status do Supervisor:"
sudo supervisorctl status nexuzap:* 2>/dev/null || echo "Supervisor não configurado"

echo ""
echo "💾 Uso de Disco:"
df -h / | tail -n 1 | awk '{print "Usado: " $3 " / Total: " $2 " (" $5 " usado)"}'

echo ""
echo "🧠 Uso de Memória:"
free -h | grep Mem | awk '{print "Usado: " $3 " / Total: " $2}'

echo ""
echo "⚡ Carga do Sistema:"
uptime | awk -F'load average:' '{print "Load Average:" $2}'

echo ""
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"

# Teste de conectividade API
echo ""
echo "🌐 Testando API Backend..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/auth/login 2>/dev/null || echo "000")

if [ "$RESPONSE" = "000" ]; then
    echo -e "${RED}❌ API não está respondendo${NC}"
elif [ "$RESPONSE" = "404" ]; then
    echo -e "${YELLOW}⚠️  API respondendo mas endpoint não encontrado${NC}"
elif [ "$RESPONSE" = "405" ] || [ "$RESPONSE" = "422" ]; then
    echo -e "${GREEN}✅ API está respondendo (Status: $RESPONSE)${NC}"
else
    echo -e "${GREEN}✅ API está respondendo (Status: $RESPONSE)${NC}"
fi