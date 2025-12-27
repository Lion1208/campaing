#!/bin/bash

# Script para aumentar limite de upload no Nginx

echo "🔧 Aumentando limite de upload de imagens..."

# Arquivo de configuração do Nginx
NGINX_CONF="/etc/nginx/sites-available/nexuzap"

# Verificar se o arquivo existe
if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ Arquivo de configuração não encontrado: $NGINX_CONF"
    echo "Criando configuração básica..."
    
    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80;
    server_name _;
    
    # Aumentar limite de upload para 50MB
    client_max_body_size 50M;
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout para uploads grandes
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
    
    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    # Ativar site
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/nexuzap 2>/dev/null || true
else
    # Adicionar/atualizar client_max_body_size
    if grep -q "client_max_body_size" "$NGINX_CONF"; then
        sed -i 's/client_max_body_size.*/client_max_body_size 50M;/' "$NGINX_CONF"
        echo "✅ Limite atualizado para 50MB"
    else
        # Adicionar após a linha do server_name
        sed -i '/server_name/a \    \n    # Aumentar limite de upload para 50MB\n    client_max_body_size 50M;' "$NGINX_CONF"
        echo "✅ Limite de 50MB adicionado"
    fi
fi

# Testar configuração
echo "🧪 Testando configuração do Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuração OK"
    echo "🔄 Reiniciando Nginx..."
    systemctl reload nginx
    echo "✅ Nginx reiniciado!"
    echo ""
    echo "🎉 Pronto! Agora você pode enviar imagens de até 50MB"
else
    echo "❌ Erro na configuração do Nginx"
    exit 1
fi
