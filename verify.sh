#!/bin/bash

################################################################################
# NEXUZAP - Verificador de Instalação
# Testa se tudo foi instalado corretamente
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
    local test_name="$1"
    local command="$2"
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $test_name${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}❌ $test_name${NC}"
        ((FAIL++))
        return 1
    fi
}

warn_check() {
    local test_name="$1"
    local command="$2"
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $test_name${NC}"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠️  $test_name (opcional)${NC}"
        ((WARN++))
    fi
}

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    NexuZap - Verificador de Instalação                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Execute como root para resultados completos: sudo bash verify.sh${NC}"
    echo ""
fi

# Verificações de Sistema
echo -e "${BLUE}[1/5] Sistema Operacional${NC}"
check "Ubuntu/Debian detectado" "grep -Ei 'ubuntu|debian' /etc/os-release"
check "Versão do SO suportada" "test $(lsb_release -rs | cut -d. -f1) -ge 20"
check "Arquitetura x86_64" "test $(uname -m) = 'x86_64'"
check "Espaço em disco (>10GB)" "test $(df / | tail -1 | awk '{print $4}') -gt 10000000"
check "Memória RAM (>1GB)" "test $(free -m | awk 'NR==2{print $2}') -gt 1000"
echo ""

# Verificações de Dependências
echo -e "${BLUE}[2/5] Dependências Instaladas${NC}"
check "Python 3.11+" "python3 --version | grep -E '3\.(11|12|13)'"
check "Node.js 20+" "node --version | grep -E 'v(20|21|22)'"
check "NPM instalado" "command -v npm"
check "MongoDB instalado" "command -v mongod"
check "Supervisor instalado" "command -v supervisorctl"
check "Git instalado" "command -v git"
warn_check "Nginx instalado" "command -v nginx"
echo ""

# Verificações de Serviços
echo -e "${BLUE}[3/5] Serviços Rodando${NC}"
check "MongoDB ativo" "systemctl is-active mongod"
check "Backend rodando (8001)" "lsof -Pi :8001 -sTCP:LISTEN -t"
check "WhatsApp rodando (3002)" "lsof -Pi :3002 -sTCP:LISTEN -t"
check "Frontend rodando (3000)" "lsof -Pi :3000 -sTCP:LISTEN -t"

# Verificar supervisor
if command -v supervisorctl >/dev/null 2>&1; then
    BACKEND_STATUS=$(supervisorctl status nexuzap-backend 2>/dev/null | awk '{print $2}')
    WHATSAPP_STATUS=$(supervisorctl status nexuzap-whatsapp 2>/dev/null | awk '{print $2}')
    FRONTEND_STATUS=$(supervisorctl status nexuzap-frontend 2>/dev/null | awk '{print $2}')
    
    check "Supervisor - Backend" "test '$BACKEND_STATUS' = 'RUNNING'"
    check "Supervisor - WhatsApp" "test '$WHATSAPP_STATUS' = 'RUNNING'"
    check "Supervisor - Frontend" "test '$FRONTEND_STATUS' = 'RUNNING'"
fi
echo ""

# Verificações de Arquivos
echo -e "${BLUE}[4/5] Arquivos e Configurações${NC}"
check "Diretório /opt/nexuzap existe" "test -d /opt/nexuzap"
check "Backend instalado" "test -f /opt/nexuzap/backend/server.py"
check "Frontend instalado" "test -d /opt/nexuzap/frontend/src"
check "WhatsApp Service instalado" "test -f /opt/nexuzap/whatsapp-service/index.js"
check "Arquivo .env backend" "test -f /opt/nexuzap/backend/.env"
check "Arquivo .env frontend" "test -f /opt/nexuzap/frontend/.env"
check "node_modules backend instalado" "test -d /opt/nexuzap/backend/venv"
check "node_modules frontend instalado" "test -d /opt/nexuzap/frontend/node_modules"
check "node_modules whatsapp instalado" "test -d /opt/nexuzap/whatsapp-service/node_modules"
warn_check "Scripts de manutenção" "test -f /opt/nexuzap/backup.sh"
echo ""

# Verificações de Conectividade
echo -e "${BLUE}[5/5] Conectividade e API${NC}"

# Teste de acesso local
if command -v curl >/dev/null 2>&1; then
    # Testar frontend
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
    check "Frontend responde (HTTP $HTTP_CODE)" "test ! -z '$HTTP_CODE' && test '$HTTP_CODE' != '000'"
    
    # Testar backend
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/auth/login 2>/dev/null)
    check "Backend API responde (HTTP $HTTP_CODE)" "test ! -z '$HTTP_CODE' && test '$HTTP_CODE' != '000'"
    
    # Testar WhatsApp service
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002 2>/dev/null)
    check "WhatsApp Service responde (HTTP $HTTP_CODE)" "test ! -z '$HTTP_CODE' && test '$HTTP_CODE' != '000'"
else
    echo -e "${YELLOW}⚠️  curl não instalado - pulando testes de API${NC}"
    ((WARN++))
fi

# Verificar firewall
if command -v ufw >/dev/null 2>&1; then
    warn_check "Firewall ativo" "ufw status | grep -q active"
fi

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    RESULTADO FINAL                        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}✅ Passou: $PASS${NC}"
echo -e "  ${RED}❌ Falhou: $FAIL${NC}"
echo -e "  ${YELLOW}⚠️  Avisos: $WARN${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  🎉 INSTALAÇÃO BEM-SUCEDIDA! ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}✅ Tudo funcionando corretamente!${NC}"
    echo ""
    
    # Mostrar informações de acesso
    IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    echo -e "${BLUE}📱 Acesse sua instalação:${NC}"
    echo -e "   Frontend: http://$IP:3000"
    echo -e "   Backend:  http://$IP:8001"
    echo ""
    echo -e "${BLUE}🔑 Login padrão:${NC}"
    echo -e "   Usuário: admin"
    echo -e "   Senha:   admin123"
    echo ""
    echo -e "${YELLOW}⚠️  Altere a senha após primeiro login!${NC}"
    echo ""
    
    if [ $WARN -gt 0 ]; then
        echo -e "${YELLOW}ℹ️  Há $WARN avisos (funcionalidades opcionais)${NC}"
    fi
    
elif [ $FAIL -lt 5 ]; then
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  ⚠️  INSTALAÇÃO PARCIAL${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Alguns componentes falharam mas o sistema pode funcionar.${NC}"
    echo ""
    echo -e "${BLUE}📋 Próximos passos:${NC}"
    echo -e "  1. Verificar logs: sudo tail -f /var/log/nexuzap_*.log"
    echo -e "  2. Executar: sudo bash /opt/nexuzap/health_check.sh"
    echo -e "  3. Consultar: /opt/nexuzap/README_VPS.md"
    
else
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ❌ INSTALAÇÃO FALHOU${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${RED}Muitos componentes falharam. Instalação pode estar incompleta.${NC}"
    echo ""
    echo -e "${BLUE}📋 Próximos passos:${NC}"
    echo -e "  1. Executar novamente: sudo bash /opt/nexuzap/install_vps.sh"
    echo -e "  2. Verificar logs de instalação: /var/log/nexuzap_install.log"
    echo -e "  3. Consultar troubleshooting: /opt/nexuzap/README_VPS.md"
    echo -e "  4. Abrir issue: https://github.com/Lion1208/campaing/issues"
fi

echo ""
exit $FAIL
