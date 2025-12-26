#!/bin/bash

################################################################################
# NEXUZAP - Fix Completo para Domínio + SSL
# Corrige TUDO de uma vez
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
echo -e "${BLUE}║       🔧 NexuZap - Fix Completo Domínio + SSL         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$EUID" -ne 0 ]; then 
    error "Execute como root: sudo bash fix_domain_ssl.sh"
fi

DOMAIN="nexuzap.com"
info "Aplicando correções para: $DOMAIN"
echo ""

################################################################################
# 1. PARAR SERVIÇOS
################################################################################

log "[1/6] Parando serviços..."
supervisorctl stop nexuzap:* >/dev/null 2>&1 || true

################################################################################
# 2. CORRIGIR BACKEND .ENV
################################################################################

log "[2/6] Corrigindo backend..."

cat > /opt/nexuzap/backend/.env <<EOF
WHATSAPP_SERVICE_URL=http://127.0.0.1:3002
MONGO_URL="mongodb://localhost:27017"
DB_NAME="nexuzap_production"
CORS_ORIGINS=https://${DOMAIN},http://${DOMAIN},https://www.${DOMAIN},http://localhost:3000
JWT_SECRET=6880464b94e7aaaae45b71b7ac2e7d22970e33f060fdb65a5d46905f2d2b162f
EOF

log "✅ Backend .env atualizado"

################################################################################
# 3. CORRIGIR FRONTEND .ENV E REBUILD
################################################################################

log "[3/6] Corrigindo frontend..."

cd /opt/nexuzap/frontend

# Remover tudo
rm -rf .env .env.local .env.production build node_modules/.cache

# Criar .env limpo
cat > .env <<EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
PORT=3000
EOF

# Criar .env.production também
cat > .env.production <<EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
PORT=3000
EOF

log "✅ Frontend .env criado"

log "  → Fazendo build de produção..."
npm run build >/dev/null 2>&1

log "✅ Build concluído"

################################################################################
# 4. CRIAR/ATUALIZAR NGINX CONFIG
################################################################################

log "[4/6] Configurando Nginx..."

cat > /etc/nginx/sites-available/nexuzap <<'NGINX_EOF'
server {
    server_name nexuzap.com www.nexuzap.com;

    # Frontend (React)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/nexuzap.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nexuzap.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = www.nexuzap.com) {
        return 301 https://$host$request_uri;
    }

    if ($host = nexuzap.com) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name nexuzap.com www.nexuzap.com;
    return 404;
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/nexuzap /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

log "✅ Nginx configurado e reiniciado"

################################################################################
# 5. CRIAR .ENV DO WHATSAPP SERVICE
################################################################################

log "[5/6] Configurando WhatsApp Service..."

cat > /opt/nexuzap/whatsapp-service/.env <<EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=nexuzap_production
WHATSAPP_PORT=3002
EOF

log "✅ WhatsApp Service configurado"

################################################################################
# 6. INICIAR TUDO
################################################################################

log "[6/6] Iniciando serviços..."

supervisorctl start nexuzap:*
sleep 5

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ FIX APLICADO COM SUCESSO!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}🌐 Acesse:${NC} https://nexuzap.com"
echo ""
echo -e "${BLUE}Status dos serviços:${NC}"
supervisorctl status nexuzap:*
echo ""
echo -e "${YELLOW}⚠️ IMPORTANTE:${NC}"
echo "   • Limpe o cache do navegador (Ctrl+Shift+Delete)"
echo "   • Ou use aba anônima (Ctrl+Shift+N)"
echo "   • Aguarde 30 segundos para tudo inicializar"
echo ""
