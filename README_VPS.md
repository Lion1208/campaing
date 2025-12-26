# 🚀 NexuZap - Guia de Instalação em VPS

## 📋 Requisitos Mínimos

### Servidor VPS
- **OS**: Ubuntu 20.04+ ou Debian 11+
- **RAM**: 2GB mínimo (4GB recomendado)
- **Disco**: 20GB de espaço livre
- **CPU**: 2 cores (4 cores recomendado)
- **Rede**: IP público e portas abertas

### Portas Necessárias
- `3000` - Frontend (React)
- `8001` - Backend (FastAPI)
- `3002` - WhatsApp Service (Node.js)
- `27017` - MongoDB (apenas localhost)
- `80/443` - Nginx (opcional, para SSL)

---

## 🎯 Instalação Automatizada (Recomendado)

### Passo 1: Acessar VPS via SSH

```bash
ssh root@SEU_IP_VPS
```

### Passo 2: Baixar e Executar Script de Instalação

```bash
# Baixar o script
wget https://raw.githubusercontent.com/Lion1208/campaing/main/install_vps.sh

# Dar permissão de execução
chmod +x install_vps.sh

# Executar instalação
sudo ./install_vps.sh
```

O script irá:
1. ✅ Atualizar o sistema
2. ✅ Instalar Python 3.11
3. ✅ Instalar Node.js 20
4. ✅ Instalar MongoDB 7.0
5. ✅ Clonar o repositório
6. ✅ Configurar variáveis de ambiente
7. ✅ Instalar todas as dependências
8. ✅ Configurar Supervisor
9. ✅ Configurar Firewall
10. ✅ Iniciar todos os serviços

**Tempo estimado**: 10-15 minutos

---

## 🔧 Instalação Manual

Se preferir instalar manualmente, siga os passos abaixo:

### 1. Atualizar Sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential software-properties-common
```

### 2. Instalar Python 3.11

```bash
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip
sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
```

### 3. Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
```

### 4. Instalar MongoDB 7.0

```bash
# Importar chave
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Adicionar repositório
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Iniciar MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 5. Clonar Repositório

```bash
sudo mkdir -p /opt/nexuzap
cd /opt
sudo git clone https://github.com/Lion1208/campaing.git nexuzap
cd nexuzap
```

### 6. Configurar Backend

```bash
cd /opt/nexuzap/backend

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install --upgrade pip
pip install -r requirements.txt

# Criar arquivo .env
cat > .env <<EOF
WHATSAPP_SERVICE_URL=http://127.0.0.1:3002
MONGO_URL="mongodb://localhost:27017"
DB_NAME="nexuzap_production"
CORS_ORIGINS=http://SEU_DOMINIO,https://SEU_DOMINIO
JWT_SECRET=$(openssl rand -hex 32)
EOF
```

### 7. Configurar Frontend

```bash
cd /opt/nexuzap/frontend

# Instalar dependências
npm install --legacy-peer-deps

# Criar arquivo .env
cat > .env <<EOF
REACT_APP_BACKEND_URL=http://SEU_DOMINIO:8001
PORT=3000
EOF
```

### 8. Configurar WhatsApp Service

```bash
cd /opt/nexuzap/whatsapp-service

# Instalar dependências
npm install --legacy-peer-deps

# Criar diretório de sessões
mkdir -p auth_sessions
```

### 9. Instalar e Configurar Supervisor

```bash
sudo apt install -y supervisor

# Criar arquivo de configuração
sudo nano /etc/supervisor/conf.d/nexuzap.conf
```

Cole o conteúdo:

```ini
[program:nexuzap-backend]
command=/opt/nexuzap/backend/venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8001
directory=/opt/nexuzap/backend
user=root
autostart=true
autorestart=true
stdout_logfile=/var/log/nexuzap_backend.log
stderr_logfile=/var/log/nexuzap_backend_error.log

[program:nexuzap-whatsapp]
command=/usr/bin/node index.js
directory=/opt/nexuzap/whatsapp-service
user=root
autostart=true
autorestart=true
stdout_logfile=/var/log/nexuzap_whatsapp.log
stderr_logfile=/var/log/nexuzap_whatsapp_error.log

[program:nexuzap-frontend]
command=/usr/bin/npm start
directory=/opt/nexuzap/frontend
user=root
autostart=true
autorestart=true
stdout_logfile=/var/log/nexuzap_frontend.log
stderr_logfile=/var/log/nexuzap_frontend_error.log

[group:nexuzap]
programs=nexuzap-backend,nexuzap-whatsapp,nexuzap-frontend
```

Atualizar supervisor:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start nexuzap:*
```

### 10. Configurar Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 3000/tcp
sudo ufw allow 8001/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

---

## 🌐 Configurar Domínio e SSL (Opcional)

### Com Nginx e Let's Encrypt

```bash
# Instalar Nginx e Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Criar configuração Nginx
sudo nano /etc/nginx/sites-available/nexuzap
```

Conteúdo:

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO.com www.SEU_DOMINIO.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Ativar configuração:

```bash
sudo ln -s /etc/nginx/sites-available/nexuzap /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Obter certificado SSL
sudo certbot --nginx -d SEU_DOMINIO.com -d www.SEU_DOMINIO.com
```

---

## 📊 Gerenciamento de Serviços

### Comandos Supervisor

```bash
# Ver status de todos os serviços
sudo supervisorctl status nexuzap:*

# Reiniciar todos os serviços
sudo supervisorctl restart nexuzap:*

# Reiniciar serviço específico
sudo supervisorctl restart nexuzap-backend
sudo supervisorctl restart nexuzap-whatsapp
sudo supervisorctl restart nexuzap-frontend

# Parar serviços
sudo supervisorctl stop nexuzap:*

# Iniciar serviços
sudo supervisorctl start nexuzap:*

# Ver logs em tempo real
sudo tail -f /var/log/nexuzap_backend.log
sudo tail -f /var/log/nexuzap_whatsapp.log
sudo tail -f /var/log/nexuzap_frontend.log
```

---

## 🔍 Troubleshooting

### Serviço não inicia

```bash
# Verificar logs
sudo supervisorctl tail -f nexuzap-backend stderr
sudo supervisorctl tail -f nexuzap-whatsapp stderr

# Verificar se portas estão em uso
sudo lsof -i :3000
sudo lsof -i :8001
sudo lsof -i :3002

# Matar processo na porta
sudo kill -9 $(sudo lsof -t -i:3000)
```

### MongoDB não conecta

```bash
# Verificar status
sudo systemctl status mongod

# Reiniciar MongoDB
sudo systemctl restart mongod

# Ver logs
sudo journalctl -u mongod -f
```

### Frontend não carrega

```bash
# Verificar .env do frontend
cat /opt/nexuzap/frontend/.env

# Reconstruir
cd /opt/nexuzap/frontend
npm install --legacy-peer-deps
sudo supervisorctl restart nexuzap-frontend
```

### Erro de permissões

```bash
# Ajustar permissões
sudo chown -R root:root /opt/nexuzap
sudo chmod -R 755 /opt/nexuzap
```

---

## 🔒 Segurança

### Alterar senha do admin

1. Acesse o sistema: `http://SEU_IP:3000`
2. Login: `admin` / `admin123`
3. Vá em Configurações → Alterar Senha

### Firewall adicional

```bash
# Permitir apenas IPs específicos no backend
sudo ufw delete allow 8001/tcp
sudo ufw allow from SEU_IP to any port 8001
```

### Backup automático

```bash
# Criar script de backup
sudo nano /opt/backup_nexuzap.sh
```

Conteúdo:

```bash
#!/bin/bash
BACKUP_DIR="/backup/nexuzap"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup MongoDB
mongodump --db nexuzap_production --out "$BACKUP_DIR/mongo_$DATE"

# Backup arquivos
tar -czf "$BACKUP_DIR/files_$DATE.tar.gz" /opt/nexuzap/backend/uploads /opt/nexuzap/whatsapp-service/auth_sessions

# Manter apenas últimos 7 dias
find $BACKUP_DIR -mtime +7 -delete
```

Agendar no cron:

```bash
sudo chmod +x /opt/backup_nexuzap.sh
sudo crontab -e

# Adicionar linha:
0 2 * * * /opt/backup_nexuzap.sh
```

---

## 🔄 Atualização

```bash
cd /opt/nexuzap

# Parar serviços
sudo supervisorctl stop nexuzap:*

# Atualizar código
sudo git pull origin main

# Atualizar dependências
cd backend
source venv/bin/activate
pip install -r requirements.txt

cd ../frontend
npm install --legacy-peer-deps

cd ../whatsapp-service
npm install --legacy-peer-deps

# Reiniciar serviços
sudo supervisorctl start nexuzap:*
```

---

## 📞 Suporte

- **GitHub**: https://github.com/Lion1208/campaing/issues
- **Documentação**: Veja este arquivo

---

## 📝 Licença

Veja o arquivo LICENSE no repositório.