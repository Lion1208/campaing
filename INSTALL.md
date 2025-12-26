# 🚀 NexuZap VPS - Guia Rápido de Instalação

## ⚡ Instalação em 1 Comando

```bash
curl -fsSL https://raw.githubusercontent.com/Lion1208/campaing/main/quick_install.sh | sudo bash
```

**OU**

```bash
wget https://raw.githubusercontent.com/Lion1208/campaing/main/install_vps.sh
chmod +x install_vps.sh
sudo ./install_vps.sh
```

---

## 📦 O que será instalado?

- ✅ Python 3.11
- ✅ Node.js 20
- ✅ MongoDB 7.0
- ✅ NexuZap (Backend + Frontend + WhatsApp Service)
- ✅ Supervisor (gerenciamento de processos)
- ✅ Firewall configurado
- ✅ Scripts de manutenção

**Tempo estimado**: 10-15 minutos

---

## 🎯 Requisitos Mínimos VPS

- **OS**: Ubuntu 20.04+ ou Debian 11+
- **RAM**: 2GB (4GB recomendado)
- **Disco**: 20GB livre
- **CPU**: 2 cores

---

## 📱 Acesso Após Instalação

- Frontend: `http://SEU_IP:3000`
- Backend: `http://SEU_IP:8001`

**Login padrão**:
- Usuário: `admin`
- Senha: `admin123`

⚠️ **Altere a senha após primeiro login!**

---

## 🔧 Comandos Úteis

```bash
# Ver status
sudo supervisorctl status nexuzap:*

# Reiniciar
sudo supervisorctl restart nexuzap:*

# Logs
sudo tail -f /var/log/nexuzap_backend.log

# Health check
sudo bash /opt/nexuzap/health_check.sh

# Backup
sudo bash /opt/nexuzap/backup.sh

# Atualizar
sudo bash /opt/nexuzap/update.sh
```

---

## 📚 Documentação Completa

- [README_VPS.md](README_VPS.md) - Guia completo de instalação
- [DOCKER_README.md](DOCKER_README.md) - Instalação com Docker
- [README.md](README.md) - Documentação geral do projeto

---

## 🆘 Suporte

**GitHub**: https://github.com/Lion1208/campaing

---

**Pronto para começar? Execute o comando de instalação acima! 🚀**
