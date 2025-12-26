# 📱 NexuZap - Sistema de Campanhas WhatsApp

## 📝 Visão Geral

NexuZap é uma plataforma completa para gerenciamento e envio de campanhas via WhatsApp. Sistema robusto, escalável e fácil de instalar em VPS.

### ✨ Funcionalidades

- 👥 **Gerenciamento de Usuários** (Admin, Master, Revendedor)
- 📱 **Múltiplas Conexões WhatsApp** com QR Code
- 📢 **Campanhas em Massa** para grupos do WhatsApp
- 📊 **Relatórios e Logs** detalhados
- 🖼️ **Gerenciamento de Mídias** (imagens, vídeos, documentos)
- ⏰ **Agendamento de Campanhas**
- 🔄 **Auto-Recuperação** de serviços
- 🔒 **Sistema de Créditos**

---

## 🚀 Instalação Rápida (VPS)

### One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/Lion1208/campaing/main/quick_install.sh | sudo bash
```

### Ou Download Manual

```bash
wget https://raw.githubusercontent.com/Lion1208/campaing/main/install_vps.sh
chmod +x install_vps.sh
sudo ./install_vps.sh
```

**Tempo de instalação**: ~10-15 minutos

---

## 📚 Documentação Completa

Para instalação detalhada, troubleshooting e configurações avançadas:

📖 **[Veja o Guia Completo de Instalação VPS](README_VPS.md)**

---

## ⚙️ Stack Tecnológico

### Backend
- **FastAPI** (Python 3.11)
- **MongoDB** 7.0
- **APScheduler** (agendamento)
- **JWT** (autenticação)

### Frontend
- **React** 19
- **Tailwind CSS**
- **Shadcn UI**
- **Zustand** (gerenciamento de estado)

### WhatsApp Service
- **Node.js** 20
- **Baileys** (WhatsApp Web API)
- **Express**

---

## 💻 Desenvolvimento Local

### Pré-requisitos

- Python 3.11+
- Node.js 20+
- MongoDB 7.0+

### Setup

```bash
# Clonar repositório
git clone https://github.com/Lion1208/campaing.git
cd campaing

# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configurar variáveis
python -m uvicorn server:app --reload --port 8001

# Frontend (novo terminal)
cd frontend
npm install
cp .env.example .env  # Configurar variáveis
npm start

# WhatsApp Service (novo terminal)
cd whatsapp-service
npm install
node index.js
```

---

## 🔧 Scripts de Manutenção

Após instalar, você terá acesso aos seguintes scripts:

```bash
# Verificar saúde do sistema
sudo bash /opt/nexuzap/health_check.sh

# Fazer backup
sudo bash /opt/nexuzap/backup.sh

# Restaurar backup
sudo bash /opt/nexuzap/restore.sh

# Atualizar sistema
sudo bash /opt/nexuzap/update.sh

# Desinstalar
sudo bash /opt/nexuzap/uninstall.sh
```

---

## 📊 Gerenciamento de Serviços

```bash
# Ver status
sudo supervisorctl status nexuzap:*

# Reiniciar todos
sudo supervisorctl restart nexuzap:*

# Reiniciar individual
sudo supervisorctl restart nexuzap-backend
sudo supervisorctl restart nexuzap-whatsapp
sudo supervisorctl restart nexuzap-frontend

# Ver logs
sudo tail -f /var/log/nexuzap_backend.log
sudo tail -f /var/log/nexuzap_whatsapp.log
sudo tail -f /var/log/nexuzap_frontend.log
```

---

## 🌐 Acesso ao Sistema

### Após Instalação

- **Frontend**: `http://SEU_IP:3000`
- **Backend API**: `http://SEU_IP:8001`

### Credenciais Padrão

- **Usuário**: `admin`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Altere a senha após primeiro login!

---

## 🔒 Segurança

### Recomendações

1. ✅ Alterar senha padrão do admin
2. ✅ Configurar firewall (script faz automaticamente)
3. ✅ Usar HTTPS em produção
4. ✅ Fazer backups regulares
5. ✅ Manter sistema atualizado

### Configurar SSL/HTTPS

Veja instruções detalhadas em [README_VPS.md](README_VPS.md#-configurar-domínio-e-ssl-opcional)

---

## 💾 Backup Automático

Configurar backup diário às 2h da manhã:

```bash
sudo crontab -e

# Adicionar:
0 2 * * * /opt/nexuzap/backup.sh
```

---

## 🔍 Troubleshooting

### Serviços não iniciam

```bash
# Verificar logs
sudo supervisorctl tail nexuzap-backend stderr
sudo supervisorctl tail nexuzap-whatsapp stderr

# Verificar portas
sudo lsof -i :3000
sudo lsof -i :8001
sudo lsof -i :3002
```

### MongoDB não conecta

```bash
sudo systemctl status mongod
sudo systemctl restart mongod
sudo journalctl -u mongod -f
```

### Health Check

```bash
sudo bash /opt/nexuzap/health_check.sh
```

---

## 📝 Estrutura do Projeto

```
campaing/
├── backend/              # FastAPI backend
│   ├── server.py         # API principal
│   ├── requirements.txt  # Dependências Python
│   └── uploads/          # Arquivos de mídia
├── frontend/             # React frontend
│   ├── src/
│   │   ├── pages/        # Páginas
│   │   ├── components/   # Componentes
│   │   └── store/        # Zustand store
│   └── package.json      # Dependências Node
├── whatsapp-service/     # Serviço WhatsApp
│   ├── index.js          # Servidor Node.js
│   └── auth_sessions/    # Sessões WhatsApp
├── install_vps.sh        # Script de instalação
├── quick_install.sh      # Instalação rápida
├── health_check.sh       # Verificação de saúde
├── backup.sh             # Script de backup
├── restore.sh            # Restaurar backup
├── update.sh             # Atualização
├── uninstall.sh          # Desinstalação
└── README_VPS.md         # Guia completo VPS
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## ❓ FAQ

### Posso usar em ambiente Windows?

Não recomendado. Use Linux (Ubuntu/Debian) para melhor compatibilidade.

### Preciso de conhecimento técnico?

Não. O script de instalação automatiza tudo. Apenas execute e responda as perguntas.

### Quanto custa hospedar?

VPS com 2GB RAM custa entre $5-10/mês em provedores como DigitalOcean, Linode, Vultr.

### É legal usar?

Sim, mas siga os termos de serviço do WhatsApp. Não envie spam.

---

## 📧 Suporte

- **Issues**: [GitHub Issues](https://github.com/Lion1208/campaing/issues)
- **Documentação**: [README_VPS.md](README_VPS.md)

---

## 📝 Licença

Este projeto é de código aberto. Veja o arquivo LICENSE.

---

## ⭐ Agradecimentos

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [FastAPI](https://fastapi.tiangolo.com/) - Framework backend
- [React](https://react.dev/) - Framework frontend
- [Shadcn UI](https://ui.shadcn.com/) - Componentes UI

---

**Feito com ❤️ para a comunidade**