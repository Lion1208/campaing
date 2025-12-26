# ✅ NexuZap VPS - Checklist de Instalação

## Antes de Começar

- [ ] VPS com Ubuntu 20.04+ ou Debian 11+
- [ ] Acesso root via SSH
- [ ] 2GB RAM mínimo (4GB recomendado)
- [ ] 20GB de espaço em disco
- [ ] Domínio apontado para o IP (opcional)

---

## 📥 Instalação

### Método 1: Quick Install (Recomendado)

```bash
curl -fsSL https://raw.githubusercontent.com/Lion1208/campaing/main/quick_install.sh | sudo bash
```

- [ ] Comando executado sem erros
- [ ] Respondeu às perguntas de configuração
- [ ] Aguardou 10-15 minutos para conclusão

### Método 2: Download Manual

```bash
wget https://raw.githubusercontent.com/Lion1208/campaing/main/install_vps.sh
chmod +x install_vps.sh
sudo ./install_vps.sh
```

- [ ] Script baixado
- [ ] Permissão de execução concedida
- [ ] Instalação concluída

---

## ✅ Verificações Pós-Instalação

### 1. Serviços Rodando

```bash
sudo supervisorctl status nexuzap:*
```

**Verificar:**
- [ ] nexuzap-backend: RUNNING
- [ ] nexuzap-whatsapp: RUNNING  
- [ ] nexuzap-frontend: RUNNING

### 2. Portas Abertas

```bash
sudo lsof -i :3000  # Frontend
sudo lsof -i :8001  # Backend
sudo lsof -i :3002  # WhatsApp
```

- [ ] Porta 3000 em uso
- [ ] Porta 8001 em uso
- [ ] Porta 3002 em uso

### 3. MongoDB Funcionando

```bash
sudo systemctl status mongod
```

- [ ] Status: active (running)

### 4. Health Check

```bash
sudo bash /opt/nexuzap/health_check.sh
```

- [ ] Todos os serviços ✅
- [ ] MongoDB ✅
- [ ] API respondendo ✅

### 5. Acesso Web

```bash
curl http://localhost:3000
curl http://localhost:8001/api/auth/login
```

- [ ] Frontend carrega
- [ ] API responde (código 405 ou 422 é OK)

---

## 🌐 Teste de Acesso Externo

### Via Navegador

1. Abrir: `http://SEU_IP:3000`
2. Fazer login: `admin` / `admin123`

- [ ] Página carrega
- [ ] Login funciona
- [ ] Dashboard aparece

---

## 🔒 Segurança

### Primeira Vez

- [ ] Alterar senha do admin
- [ ] Firewall ativado (`sudo ufw status`)
- [ ] Gerar novo JWT_SECRET

```bash
# Gerar nova chave JWT
openssl rand -hex 32
# Atualizar em /opt/nexuzap/backend/.env
```

### SSL/HTTPS (Opcional mas Recomendado)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d seudominio.com
```

- [ ] Certificado SSL instalado
- [ ] HTTPS funcionando

---

## 📦 Backup

### Configurar Backup Automático

```bash
sudo bash /opt/nexuzap/cron_setup.sh
```

- [ ] Cron configurado
- [ ] Backup teste: `sudo bash /opt/nexuzap/backup.sh`
- [ ] Arquivo criado em `/backup/nexuzap/`

---

## 🔧 Comandos Essenciais Salvos

### Gerenciamento

```bash
# Ver status
sudo supervisorctl status nexuzap:*

# Reiniciar tudo
sudo supervisorctl restart nexuzap:*

# Reiniciar serviço específico
sudo supervisorctl restart nexuzap-backend

# Ver logs em tempo real
sudo tail -f /var/log/nexuzap_backend.log
sudo tail -f /var/log/nexuzap_whatsapp.log

# Health check
sudo bash /opt/nexuzap/health_check.sh
```

### Manutenção

```bash
# Backup manual
sudo bash /opt/nexuzap/backup.sh

# Restaurar backup
sudo bash /opt/nexuzap/restore.sh

# Atualizar sistema
sudo bash /opt/nexuzap/update.sh
```

---

## ❌ Solução de Problemas

### Serviço não inicia

```bash
# Ver erro detalhado
sudo supervisorctl tail nexuzap-backend stderr
sudo supervisorctl tail nexuzap-whatsapp stderr

# Reiniciar
sudo supervisorctl restart nexuzap-backend
```

- [ ] Problema identificado
- [ ] Solução aplicada

### Porta em uso

```bash
# Verificar processo
sudo lsof -i :3000

# Matar processo
sudo kill -9 <PID>

# Reiniciar serviço
sudo supervisorctl restart nexuzap-frontend
```

### MongoDB não conecta

```bash
sudo systemctl status mongod
sudo systemctl restart mongod
sudo journalctl -u mongod -n 50
```

- [ ] MongoDB reiniciado
- [ ] Conexão funcionando

---

## 📝 Informações do Sistema

**Anotar:**

- IP do servidor: _______________
- Domínio (se houver): _______________
- Porta Frontend: _______________
- Porta Backend: _______________
- Usuário admin: _______________
- Senha admin (nova): _______________
- Data instalação: _______________
- Versão instalada: _______________

---

## 🎯 Próximos Passos

Após instalação:

- [ ] Ler [README_VPS.md](README_VPS.md) completo
- [ ] Configurar backup automático
- [ ] Configurar SSL/HTTPS se tiver domínio
- [ ] Criar usuários adicionais
- [ ] Configurar primeira conexão WhatsApp
- [ ] Testar envio de campanha teste
- [ ] Monitorar logs por 24h

---

## 📞 Suporte

**Encontrou problemas?**

1. Verificar logs: `sudo tail -f /var/log/nexuzap_*.log`
2. Executar health check: `sudo bash /opt/nexuzap/health_check.sh`
3. Consultar [README_VPS.md](README_VPS.md) seção Troubleshooting
4. Abrir issue: https://github.com/Lion1208/campaing/issues

---

✅ **Sistema instalado e funcionando? Parabéns! 🎉**
