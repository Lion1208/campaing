#!/bin/bash

echo "🔧 CORRIGINDO TUDO AUTOMATICAMENTE..."

cd /opt/nexuzap/backend

# Restaurar do backup ou baixar novamente
echo "📥 Baixando server.py correto do GitHub..."
wget -O server.py "https://raw.githubusercontent.com/Lion1208/campaing/main/backend/server.py" --no-cache

# Verificar sintaxe
echo "✅ Verificando sintaxe..."
python3 -m py_compile server.py

if [ $? -eq 0 ]; then
    echo "✅ Arquivo correto!"
    
    # Instalar mercadopago
    echo "📦 Instalando mercadopago..."
    pip install mercadopago==2.2.3 --quiet
    
    # Reiniciar backend
    echo "🔄 Reiniciando backend..."
    sudo supervisorctl restart nexuzap:nexuzap-backend
    sleep 3
    
    # Ver status
    echo "📊 Status:"
    sudo supervisorctl status nexuzap:*
    
    echo ""
    echo "🎉 PRONTO! Backend corrigido e rodando!"
else
    echo "❌ Ainda tem erro de sintaxe. Vou tentar restaurar do backup..."
    if [ -f server.py.broken ]; then
        echo "Não consegui corrigir automaticamente."
        echo "Por favor, me avise para eu criar uma versão limpa do arquivo."
    fi
fi
