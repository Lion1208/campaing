# 🕐 Configurar Horário de Brasília no NexuZap

## ⚠️ Problema
A VPS pode estar configurada com timezone diferente (UTC, Europe, etc), fazendo com que as campanhas agendadas sejam enviadas no horário errado.

## ✅ Solução

### Opção 1: Script Automático (Recomendado)

No seu VPS, execute:

```bash
cd /opt/nexuzap
wget https://raw.githubusercontent.com/Lion1208/campaing/main/set_timezone.sh
chmod +x set_timezone.sh
sudo ./set_timezone.sh
```

**O que o script faz:**
- ✅ Configura timezone para `America/Sao_Paulo`
- ✅ Mostra horário antes e depois
- ✅ Reinicia todos os serviços
- ✅ Confirma que está tudo OK

---

### Opção 2: Manual

```bash
# Ver timezone atual
timedatectl

# Configurar para Brasília
sudo timedatectl set-timezone America/Sao_Paulo

# Verificar
date

# Reiniciar serviços
sudo supervisorctl restart nexuzap:*
```

---

## 📋 Verificar se está correto

```bash
# Ver timezone
timedatectl | grep "Time zone"
# Deve mostrar: America/Sao_Paulo (BRT ou BRST)

# Ver hora atual
date "+%d/%m/%Y %H:%M:%S %Z"
# Deve mostrar horário de Brasília
```

---

## 🎯 Como funciona

### Backend já está configurado! ✅

No código do backend (`server.py` linha 72):

```python
scheduler = AsyncIOScheduler(timezone='America/Sao_Paulo')
```

**E também:**
- Linha 1303: `sp_tz = pytz.timezone('America/Sao_Paulo')`
- Todo o agendamento usa timezone correto

**O problema estava apenas na VPS!**

Ao configurar o timezone da VPS, o Python automaticamente usa o horário correto do sistema.

---

## 🧪 Testar

1. Configure o timezone
2. Crie uma campanha agendada para daqui 2 minutos
3. Verifique se ela é enviada no horário correto de Brasília

---

## ⏰ Timezones Disponíveis

```bash
# Listar todos os timezones do Brasil
timedatectl list-timezones | grep Brazil
timedatectl list-timezones | grep America/Sao
```

**Principais:**
- `America/Sao_Paulo` - Brasília (SP, RJ, MG, etc)
- `America/Manaus` - Amazonas (AM)
- `America/Fortaleza` - Ceará (CE)
- `America/Recife` - Pernambuco (PE)

---

## 🔧 Troubleshooting

### Horário ainda está errado?

```bash
# Verificar se NTP está sincronizado
timedatectl

# Se NTP estiver desabilitado, habilitar
sudo timedatectl set-ntp true

# Forçar sincronização
sudo systemctl restart systemd-timesyncd
```

### Campanhas ainda no horário errado?

```bash
# Ver logs do scheduler
sudo tail -f /var/log/nexuzap_backend.log | grep -i schedule

# Reiniciar backend
sudo supervisorctl restart nexuzap-backend
```

---

## ✅ Checklist Final

- [ ] Timezone da VPS configurado: `America/Sao_Paulo`
- [ ] Comando `date` mostra horário de Brasília
- [ ] Serviços reiniciados
- [ ] Teste de campanha agendada funcionou

**Pronto! Agora todas as campanhas usarão horário de Brasília! 🇧🇷**
