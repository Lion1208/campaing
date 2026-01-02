# 📋 PLANO DE IMPLEMENTAÇÃO - SISTEMA DE MONETIZAÇÃO

## 🎯 OBJETIVO
Sistema completo de planos, renovação e créditos com Mercado Pago PIX

---

## 📊 FASE 1: Backend - Modelos e Estrutura (30min)
- [  ] Criar modelos Pydantic para Planos, Gateways, Transações
- [  ] Criar rotas CRUD de planos (admin apenas)
- [  ] Criar rotas CRUD de gateways (admin/master)
- [  ] Criar rota de loja de créditos (admin configura, master compra)

## 📊 FASE 2: Integração Mercado Pago (45min)
- [  ] Instalar SDK Mercado Pago
- [  ] Criar função para gerar PIX (QR Code + Copia e Cola)
- [  ] Criar webhook para receber notificações de pagamento
- [  ] Atualizar créditos/expiração automaticamente

## 📊 FASE 3: Sistema de Expiração (30min)
- [  ] Criar verificação de expiração no login
- [  ] Criar tela de renovação obrigatória
- [  ] Criar aviso de vencimento (7 dias antes)
- [  ] Bloquear acesso se expirado

## 📊 FASE 4: Links de Convite (30min)
- [  ] Criar modelo e rotas de links de convite
- [  ] Gerar links com expiração e limite de usos
- [  ] Cadastro público via link (usuário fica bloqueado)
- [  ] Botão "Liberar Teste" manual (admin/master)

## 📊 FASE 5: Histórico Financeiro (20min)
- [  ] Criar modelo de transações
- [  ] Criar página de histórico (admin/master)
- [  ] Dashboard com estatísticas (total faturado, renovações)

## 📊 FASE 6: Frontend - Páginas (60min)
- [  ] Página "Planos" (admin configura)
- [  ] Página "Gateways" (admin/master configura MP)
- [  ] Página "Loja de Créditos" (admin cria, master compra)
- [  ] Página "Financeiro" (histórico e estatísticas)
- [  ] Tela de renovação obrigatória
- [  ] Aviso no menu lateral (7 dias antes)

## 📊 FASE 7: Permissões e Restrições (30min)
- [  ] Atualizar sidebar com novas páginas
- [  ] Aplicar permissões por role
- [  ] Usuários teste: acesso limitado
- [  ] Consumir crédito ao renovar usuário

## 📊 FASE 8: Testes e Ajustes (30min)
- [  ] Testar fluxo completo de renovação
- [  ] Testar compra de créditos
- [  ] Testar links de convite
- [  ] Testar webhook Mercado Pago

---

## ⏱️ TEMPO TOTAL ESTIMADO: ~4h

---

## 🔧 ESTRUTURA DE DADOS

### Collection: `plans`
```json
{
  "id": "uuid",
  "name": "Plano Revendedor",
  "role": "reseller",
  "max_connections": 5,
  "duration_months": 1,
  "price": 49.90,
  "description": "Até 5 conexões",
  "active": true,
  "created_at": "datetime"
}
```

### Collection: `gateways`
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "provider": "mercadopago",
  "access_token": "encrypted",
  "monthly_price": 49.90,
  "custom_prices": {
    "reseller_user_id": 39.90
  },
  "active": true,
  "created_at": "datetime"
}
```

### Collection: `credit_plans`
```json
{
  "id": "uuid",
  "name": "10 Créditos",
  "credits": 10,
  "price": 99.90,
  "active": true,
  "created_at": "datetime"
}
```

### Collection: `transactions`
```json
{
  "id": "uuid",
  "type": "renewal" | "credit_purchase",
  "user_id": "uuid",
  "master_id": "uuid",
  "amount": 49.90,
  "status": "pending" | "approved" | "cancelled",
  "payment_id": "mercadopago_id",
  "qr_code": "base64",
  "qr_code_text": "copia_e_cola",
  "created_at": "datetime",
  "paid_at": "datetime"
}
```

### Collection: `invite_links`
```json
{
  "id": "uuid",
  "code": "ABC123",
  "created_by": "uuid",
  "test_hours": 24,
  "max_uses": 10,
  "uses": 0,
  "expires_at": "datetime",
  "active": true,
  "created_at": "datetime"
}
```

---

## 🚀 PRÓXIMOS PASSOS

Vou começar pela **FASE 1** criando todos os modelos e rotas do backend.

Confirme para eu iniciar! 🎯
