#!/bin/bash

echo "🔍 DIAGNÓSTICO COMPLETO - NexuZap"
echo "=================================="
echo ""

echo "1️⃣ Status dos Serviços:"
supervisorctl status nexuzap:* || supervisorctl status

echo ""
echo "2️⃣ Conexões no Banco:"
mongosh test_database --quiet --eval "db.connections.find({}, {id:1, name:1, status:1, phone_number:1}).forEach(printjson)"

echo ""
echo "3️⃣ Campanhas Ativas:"
mongosh test_database --quiet --eval "db.campaigns.find({status: {'\$in': ['active', 'running']}}, {id:1, title:1, status:1, connection_id:1, schedule_type:1}).forEach(printjson)"

echo ""
echo "4️⃣ Últimas 10 linhas - Backend:"
tail -n 10 /var/log/supervisor/backend.out.log

echo ""
echo "5️⃣ Últimas 10 linhas - WhatsApp:"
tail -n 10 /var/log/supervisor/whatsapp.out.log

echo ""
echo "6️⃣ Verificando Path do WhatsApp Service:"
ls -la /opt/nexuzap/whatsapp-service/index.js 2>&1
ls -la /app/whatsapp-service/index.js 2>&1

echo ""
echo "7️⃣ Processos WhatsApp rodando:"
ps aux | grep -i whatsapp | grep -v grep

echo ""
echo "=================================="
echo "✅ Diagnóstico completo!"
