# 📦 Instruções de Deploy para VPS

Este documento contém as instruções para fazer deploy das alterações do GitHub para sua VPS sem perder dados.

## 🔧 Correção Aplicada

**Bug corrigido:** Sincronização de grupos falha após reinicialização do servidor.

**O que foi modificado:**
- `/app/whatsapp-service/index.js` - Melhorias na busca automática de grupos após reconexão e logs detalhados

## 📝 Passo 1: Fazer Push no GitHub

No seu computador local (onde você tem o código):

```bash
# Navegue até o diretório do projeto
cd /caminho/para/nexuzap

# Adicione todas as alterações
git add .

# Faça o commit
git commit -m "fix: corrige sincronização de grupos após reinicialização"

# Envie para o GitHub
git push origin main
```

## 🚀 Passo 2: Atualizar na VPS

**IMPORTANTE:** O script `update_vps.sh` já está configurado para fazer tudo automaticamente, preservando seus dados do MongoDB.

Na sua VPS, execute:

```bash
# Navegue até o diretório da aplicação
cd /opt/nexuzap

# Execute o script de atualização
sudo ./update_vps.sh
```

## ✅ O que o script faz automaticamente:

1. ✅ Faz backup automático do MongoDB (salvo em `/opt/nexuzap/backups/`)
2. ✅ Puxa as últimas alterações do GitHub (`git pull`)
3. ✅ Atualiza dependências do backend (Python) se necessário
4. ✅ Atualiza dependências do frontend (Node.js) se necessário
5. ✅ Atualiza dependências do whatsapp-service
6. ✅ Reconstrói o frontend se houver alterações
7. ✅ Reinicia todos os serviços (backend, frontend, whatsapp-service)
8. ✅ Verifica se tudo está funcionando

## 🔍 Passo 3: Verificar se funcionou

Após a atualização, acesse `https://nexuzap.com` e:

1. Vá em **Conexões**
2. Clique em **Sincronizar Grupos** na sua conexão ativa
3. Os grupos devem aparecer normalmente

## 📋 Logs para Diagnóstico

Se ainda tiver problemas, você pode verificar os logs:

```bash
# Ver logs do WhatsApp Service (últimas 50 linhas)
sudo tail -n 50 /var/log/supervisor/nexuzap-whatsapp.out.log

# Ver logs do Backend
sudo tail -n 50 /var/log/supervisor/nexuzap-backend.out.log

# Ver logs em tempo real (pressione Ctrl+C para sair)
sudo tail -f /var/log/supervisor/nexuzap-whatsapp.out.log
```

## ❓ Problemas?

Se algo der errado, você pode:

1. **Restaurar backup do MongoDB:**
```bash
cd /opt/nexuzap
sudo ./restore.sh
```

2. **Ver status dos serviços:**
```bash
sudo supervisorctl status
```

3. **Reiniciar manualmente:**
```bash
sudo supervisorctl restart nexuzap-backend
sudo supervisorctl restart nexuzap-frontend
sudo supervisorctl restart nexuzap-whatsapp
```

## 📞 Suporte

Se precisar de ajuda, me envie:
- Os logs do whatsapp-service (comando acima)
- Print da página de Conexões
- Descrição do que aconteceu

---

**✨ Feito! Seus dados estão seguros e a aplicação será atualizada sem perder nada.**
