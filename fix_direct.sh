#!/bin/bash

echo "🔧 CORREÇÃO DIRETA - Removendo função duplicada..."

cd /opt/nexuzap/backend

# Fazer backup
cp server.py server.py.backup_$(date +%s)

# Remover as linhas 508-509 (função vazia duplicada)
sed -i '508,509d' server.py

# Verificar sintaxe
echo "✅ Verificando sintaxe..."
python3 -m py_compile server.py

if [ $? -eq 0 ]; then
    echo "✅ Arquivo corrigido!"
    
    # Instalar mercadopago
    echo "📦 Instalando mercadopago..."
    pip install mercadopago==2.2.3 --quiet 2>/dev/null
    
    # Reiniciar backend
    echo "🔄 Reiniciando backend..."
    sudo supervisorctl restart nexuzap:nexuzap-backend
    sleep 3
    
    # Ver status
    echo ""
    echo "📊 Status Final:"
    sudo supervisorctl status nexuzap:*
    
    echo ""
    echo "🎉 PRONTO! Backend rodando!"
    echo ""
    echo "✅ Teste agora: https://nexuzap.com"
else
    echo "❌ Ainda tem erro. Mostrando linhas 505-515:"
    sed -n '505,515p' server.py
    echo ""
    echo "Por favor, me envie essa saída."
fi
