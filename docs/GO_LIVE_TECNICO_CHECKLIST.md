# GO-LIVE TECNICO - CHECKLIST FINAL

## 1) Objetivo

Checklist de publicacao para reduzir risco operacional no backend (API), frontend (checkout) e ambiente.

## 2) Controles ja aplicados nesta release

- Endpoint `/metrics` protegido por ambiente e token em producao.
- Fail-fast de startup em producao para variaveis criticas (`BASE_URL`, `PAGBANK_TOKEN`, `METRICS_TOKEN`).
- Antiabuso no checkout com reCAPTCHA em criacao de pedido e pagamentos (PIX/cartao) via flags.
- Validacoes extras em pagamento para impedir novo pagamento em pedido finalizado.
- Sanitizacao de logs para evitar vazamento de token em URL de webhook.
- Paginas legais publicas criadas e linkadas no layout.
- Higiene de versionamento aplicada para remover `frontend-react/.env`, `frontend-react/.env.local` e `frontend-react/node_modules` do indice Git.

## 3) Variaveis de ambiente obrigatorias (producao)

### Backend

- `NODE_ENV=production`
- `BASE_URL=https://...` (obrigatoriamente HTTPS)
- `PAGBANK_TOKEN=...`
- `METRICS_ENABLED=true|false`
- `METRICS_TOKEN=...` (obrigatorio quando `METRICS_ENABLED=true`)
- `RECAPTCHA_SECRET_KEY=...` (obrigatorio se alguma flag abaixo estiver `true`)
- `RECAPTCHA_CHECKOUT_ENABLED=true|false`
- `RECAPTCHA_PAYMENT_ENABLED=true|false`

### Frontend

- `VITE_API_URL=https://...`
- `VITE_RECAPTCHA_CHECKOUT_ENABLED=true|false`
- `VITE_RECAPTCHA_SITE_KEY=...` (obrigatorio se `VITE_RECAPTCHA_CHECKOUT_ENABLED=true`)

## 4) Checklist de pre-go-live

- [ ] Confirmar `BASE_URL` de producao com HTTPS valido.
- [ ] Confirmar `PAGBANK_TOKEN` valido no ambiente de producao.
- [ ] Definir estrategia de metricas:
  - [ ] `METRICS_ENABLED=false` para desabilitar endpoint em producao, ou
  - [ ] `METRICS_ENABLED=true` + `METRICS_TOKEN` forte e rotacao definida.
- [ ] Confirmar flags de reCAPTCHA conforme politica antifraude.
- [ ] Preencher placeholders das paginas legais com dados reais da empresa.
- [ ] Garantir que arquivos `.env` locais nao estao rastreados.

## 5) Validacoes tecnicas obrigatorias

### 5.1 Build frontend

```bash
cd frontend-react
npm run build
```

Esperado: build concluido sem erro fatal.

### 5.2 Sintaxe backend

```bash
cd backend
node --check server.js
```

Esperado: sem erros de sintaxe.

### 5.3 Fail-fast de startup (producao)

Teste negativo (deve falhar):

```bash
NODE_ENV=production BASE_URL=http://inseguro.local PAGBANK_TOKEN=teste node backend/server.js
```

Esperado: erro de startup por `BASE_URL` sem HTTPS.

### 5.4 Protecao de /metrics em producao

Sem token:

```bash
curl -i https://SEU_BACKEND/metrics
```

Esperado: `401` (ou `404` se endpoint estiver desabilitado por `METRICS_ENABLED=false`).

Com token:

```bash
curl -i -H "x-metrics-token: SEU_TOKEN" https://SEU_BACKEND/metrics
```

Esperado: `200` quando endpoint estiver habilitado.

### 5.5 Smoke do checkout com reCAPTCHA

- Caso A: `VITE_RECAPTCHA_CHECKOUT_ENABLED=false`
  - Checkout deve funcionar sem widget.
- Caso B: `VITE_RECAPTCHA_CHECKOUT_ENABLED=true`
  - Widget deve aparecer e bloquear envio sem token valido.
  - Backend deve validar `recaptcha_token` quando flags de backend estiverem ativas.

## 6) Pos deploy (primeira hora)

- [ ] Monitorar erros 4xx/5xx no backend.
- [ ] Validar 1 pedido real em cada forma de pagamento ativa (PIX, credito/debito).
- [ ] Validar recebimento de webhook do PagBank.
- [ ] Validar fluxo de status do pedido no painel admin.
- [ ] Registrar hora de go-live e responsavel tecnico.

## 7) Rollback rapido

- Reverter release para ultimo commit estavel.
- Restaurar envs anteriores no provedor.
- Reexecutar checklist de health (`/api`, checkout basico, login admin).
- Registrar incidente e causa raiz no documento de release.
