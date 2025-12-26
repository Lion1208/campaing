#!/bin/bash

################################################################################
# NEXUZAP - Configurar Nginx + SSL (Let's Encrypt)
# Acesso sem porta: https://nexuzap.com
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
info() { echo -e "${BLUE}[ℹ]${NC} $1"; }

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🔒 NexuZap - Configurar Nginx + SSL (HTTPS)       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    error "Execute como root: sudo bash setup_nginx_ssl.sh"
fi

# Solicitar domínio
read -p "Digite seu domínio (ex: nexuzap.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
    error "Domínio não pode ser vazio!"
fi

info "Domínio: $DOMAIN"
echo ""

################################################################################
# ETAPA 1: INSTALAR CERTBOT
################################################################################

log "[1/5] Instalando Certbot..."

apt-get update -qq
apt-get install -y -qq certbot python3-certbot-nginx

log "✅ Certbot instalado"

################################################################################
# ETAPA 2: CONFIGURAR NGINX
################################################################################

log "[2/5] Configurando Nginx..."

# Criar configuração do Nginx
cat > /etc/nginx/sites-available/nexuzap <<EOF
# NexuZap - Nginx Configuration
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    # Frontend (React)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        if (\$request_method = OPTIONS) {
            return 204;
        }
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

# Ativar configuração
ln -sf /etc/nginx/sites-available/nexuzap /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t || error "Erro na configuração do Nginx"

# Reiniciar Nginx
systemctl restart nginx

log "✅ Nginx configurado"

################################################################################
# ETAPA 3: OBTER CERTIFICADO SSL
################################################################################

log "[3/5] Obtendo certificado SSL (Let's Encrypt)..."

# Solicitar email
read -p "Digite seu email para renovações SSL: " EMAIL

if [ -z "$EMAIL" ]; then
    error "Email não pode ser vazio!"
fi

# Obter certificado
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

log "✅ Certificado SSL instalado"

################################################################################
# ETAPA 4: ATUALIZAR .ENV DO BACKEND
################################################################################

log "[4/5] Atualizando configuração do backend..."

# Backup do .env
cp /opt/nexuzap/backend/.env /opt/nexuzap/backend/.env.backup.$(date +%Y%m%d_%H%M%S)

# Atualizar CORS
sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=https://${DOMAIN},http://${DOMAIN},https://www.${DOMAIN},http://localhost:3000|g" /opt/nexuzap/backend/.env

log "✅ Backend atualizado"

################################################################################
# ETAPA 5: ATUALIZAR .ENV DO FRONTEND
################################################################################

log "[5/5] Atualizando configuração do frontend..."

# Backup do .env
cp /opt/nexuzap/frontend/.env /opt/nexuzap/frontend/.env.backup.$(date +%Y%m%d_%H%M%S)

# Atualizar URL do backend
sed -i "s|REACT_APP_BACKEND_URL=.*|REACT_APP_BACKEND_URL=https://${DOMAIN}|g" /opt/nexuzap/frontend/.env

# Reiniciar serviços
supervisorctl restart nexuzap:* >/dev/null 2>&1
sleep 5

log "✅ Frontend atualizado"

################################################################################
# CONCLUSÃO
################################################################################

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}🌐 Acesse seu sistema:${NC}"
echo "   https://$DOMAIN"
echo "   https://www.$DOMAIN"
echo ""
echo -e "${BLUE}🔒 SSL:${NC} Let's Encrypt (renovação automática)"
echo -e "${BLUE}⚡ Servidor:${NC} Nginx (reverse proxy)"
echo ""
echo -e "${YELLOW}📌 Observações:${NC}"
echo "   • Certificado renova automaticamente a cada 90 dias"
echo "   • HTTP redireciona automaticamente para HTTPS"
echo "   • Acesso direto às portas 3000/8001 ainda funciona"
echo ""
echo -e "${BLUE}Status dos serviços:${NC}"
supervisorctl status nexuzap:*
echo ""
