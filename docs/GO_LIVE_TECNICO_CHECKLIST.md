# GO-LIVE TECNICO - CHECKLIST FINAL

> Atualizado: março 2026 — fase de fechamento final.

---

## 1) Objetivo

Checklist de publicacao para reduzir risco operacional no backend (API), frontend (checkout) e ambiente.
Cada item deve ser marcado por quem executou, com data.

---

## 2) Controles ja aplicados nesta release

- Endpoint `/metrics` protegido por ambiente e token em producao.
- Fail-fast de startup em producao para variaveis criticas (`BASE_URL`, `PAGBANK_TOKEN`, `METRICS_TOKEN`).
- Antiabuso no checkout com reCAPTCHA em criacao de pedido e pagamentos (PIX/cartao) via flags.
- Validacoes extras em pagamento para impedir novo pagamento em pedido finalizado.
- Sanitizacao de logs para evitar vazamento de token em URL de webhook.
- Paginas legais publicas criadas e linkadas no layout.
- Higiene de versionamento aplicada para remover `frontend-react/.env`, `frontend-react/.env.local` e `frontend-react/node_modules` do indice Git.
- ToastContext global para feedback visual (carrinho, operacoes).
- useDocumentHead para SEO/meta tags em paginas-chave.
- Skip-to-content e role="alert" para acessibilidade.
- Hardcodes de contato centralizados em config/store.js.
- Logger estruturado (JSON em producao) em todos os caminhos criticos incluindo webhooks.
- Sentry preparado com stubs (zero crash sem DSN).
- Idempotencia de webhooks PagBank via BoundedCache (2000 entradas, TTL 10min).
- Deteccao de duplicatas de mensagens Evolution via BoundedCache.
- ErrorBoundary global no frontend com fallback e retry.

---

## 3) Variaveis de ambiente obrigatorias

### 3.1 Backend (obrigatorias em producao)

| Variavel | Descricao |
|----------|-----------|
| `NODE_ENV=production` | Ativa fail-fast, JSON logs, cookie seguro |
| `DATABASE_URL` | Conexao MySQL |
| `BASE_URL=https://...` | URL publica do backend (HTTPS obrigatorio) |
| `JWT_SECRET` | Chave secreta JWT (minimo 32 caracteres) |
| `PAGBANK_TOKEN` | Token do PagBank (producao) |
| `PAGBANK_WEBHOOK_TOKEN` | Token de validacao de webhooks |
| `CORS_ORIGINS` | Origens permitidas (incluir dominio Vercel) |
| `COOKIE_SECURE=true` | Cookies seguros via HTTPS |
| `COOKIE_SAME_SITE=none` | Necessario para frontend em dominio diferente |

### 3.2 Backend (recomendadas)

| Variavel | Descricao |
|----------|-----------|
| `ADMIN_PASSWORD_HASH` | Hash bcrypt da senha admin (evita texto plano) |
| `RECAPTCHA_SECRET_KEY` | Se flags de reCAPTCHA ativas |
| `SENTRY_DSN` | Captura de erros (requer `npm install @sentry/node`) |
| `LOG_LEVEL` | Nivel de log (default: info) |
| `METRICS_ENABLED` + `METRICS_TOKEN` | Metricas operacionais |
| `PAGBANK_PUBLIC_KEY` | Criptografia de cartao no frontend |

### 3.3 Frontend (obrigatorias em producao)

| Variavel | Descricao |
|----------|-----------|
| `VITE_API_URL=https://...` | URL publica do backend |

### 3.4 Frontend (recomendadas)

| Variavel | Descricao |
|----------|-----------|
| `VITE_RECAPTCHA_SITE_KEY` | Se reCAPTCHA habilitado |
| `VITE_RECAPTCHA_CHECKOUT_ENABLED` | Flag de reCAPTCHA no checkout |

---

## 4) Infra e Ambiente

- [ ] Env vars obrigatorias configuradas no Render (backend) e Vercel (frontend)
- [ ] Secrets validos (JWT_SECRET, PAGBANK_TOKEN, PAGBANK_WEBHOOK_TOKEN)
- [ ] Dominio/origem correta em CORS_ORIGINS
- [ ] Render com plano adequado (nao free tier para producao critica)
- [ ] Vercel com Root Directory = `frontend-react`
- [ ] TLS/HTTPS ativo em ambos (Render e Vercel fornecem por padrao)
- [ ] Cookie domain configurado se necessario

---

## 5) Banco de Dados

- [ ] Migrations aplicadas (executar `npm run migrate` na ordem)
- [ ] Schema consistente com `database.sql` + 14 migrations
- [ ] Indices principais presentes (verificar performance de consultas frequentes)
- [ ] Backup/restauracao considerados (snapshot antes do go-live)
- [ ] Conexao MySQL estavel e pool configurado

---

## 6) Backend

- [ ] `node --check server.js` sem erros de sintaxe
- [ ] Sobe sem erro em modo producao: `NODE_ENV=production node server.js`
- [ ] Fail-fast funciona (rejeita BASE_URL sem HTTPS)
- [ ] Logger estruturado ativo (JSON no stdout)
- [ ] Sentry pronto (ativar com `npm install @sentry/node` + `SENTRY_DSN`)
- [ ] Health checks respondendo: `GET /health`, `GET /ready`, `GET /api`
- [ ] Webhooks PagBank respondendo: `POST /api/webhooks/pagbank`
- [ ] Webhook Evolution respondendo (se ativo)
- [ ] 84 testes passando (`npm test`)
- [ ] Rate limiting ativo em rotas sensiveis

---

## 7) Frontend

- [ ] `npm run build` sem erros (210 modulos)
- [ ] Todas as rotas acessiveis (/, /produtos, /pagamento, /pedidos, /conta, /admin, /sobre, legais)
- [ ] Meta tags basicas presentes (useDocumentHead em 5 paginas)
- [ ] Toasts funcionando (adicionar ao carrinho)
- [ ] ErrorBoundary funcionando (tela de fallback com retry)
- [ ] Skip-to-content e sr-only funcionais
- [ ] role="alert" nos erros principais

---

## 8) Pagamentos

- [ ] PagBank credenciais de producao validas
- [ ] PIX testado end-to-end (pedido → QR code → webhook → status atualizado)
- [ ] Cartao de credito testado (tokenizacao → cobranca → webhook)
- [ ] Debito/3DS testado (fluxo de autenticacao → cobranca)
- [ ] Webhook PagBank recebido e processado corretamente
- [ ] Idempotencia validada (webhook duplicado nao gera duplicidade)
- [ ] PAGBANK_PUBLIC_KEY configurada para criptografia frontend
- [ ] notification_url com HTTPS e token correto

---

## 9) Operacao

- [ ] Admin acessivel com credenciais corretas
- [ ] Dashboard/gerencia carregando dados
- [ ] Lista de pedidos funcionando com filtros
- [ ] Mudanca de status de pedido funcionando
- [ ] Importacao/exportacao de produtos abrindo
- [ ] Contato WhatsApp funcionando (link correto do store.js)
- [ ] Frete calculando corretamente (CEP da loja configurado)
- [ ] Limites de entrega coerentes (LIMITE_BIKE_KM)

---

## 10) Observabilidade

- [ ] Logs JSON estruturados em producao
- [ ] Erros criticos rastreaveis (stack trace no logger)
- [ ] Sentry ativo ou pronto para ativacao (SENTRY_DSN + @sentry/node)
- [ ] Web Vitals coletando (se VITE_ENABLE_WEB_VITALS=true)
- [ ] Pagbank debug logs configuravel (PAGBANK_DEBUG_LOGS)

---

## 11) Validacoes Tecnicas

### 11.1 Build frontend

```bash
cd frontend-react && npm run build
```

Esperado: build concluido sem erro fatal.

### 11.2 Sintaxe backend

```bash
cd backend && node --check server.js
```

Esperado: sem erros de sintaxe.

### 11.3 Testes backend

```bash
cd backend && npm test
```

Esperado: 84 testes passando, 6 suites.

### 11.4 Fail-fast de startup (producao)

Teste negativo (deve falhar):

```bash
NODE_ENV=production BASE_URL=http://inseguro.local PAGBANK_TOKEN=teste node server.js
```

Esperado: erro de startup por `BASE_URL` sem HTTPS.

### 11.5 Protecao de /metrics

Sem token:

```bash
curl -i https://SEU_BACKEND/metrics
```

Esperado: `401` ou `404`.

Com token:

```bash
curl -i -H "x-metrics-token: SEU_TOKEN" https://SEU_BACKEND/metrics
```

Esperado: `200` quando habilitado.

### 11.6 Smoke do checkout

- Sem reCAPTCHA: checkout funciona normalmente.
- Com reCAPTCHA: widget aparece e bloqueia envio sem token.

---

## 12) Pos-deploy (primeira hora)

- [ ] Monitorar erros 4xx/5xx no backend
- [ ] Validar 1 pedido real em PIX
- [ ] Validar 1 pedido real em cartao (se ativo)
- [ ] Validar recebimento de webhook PagBank
- [ ] Validar fluxo de status no painel admin
- [ ] Verificar logs JSON no Render (stdout)
- [ ] Registrar hora de go-live e responsavel tecnico

---

## 13) Rollback rapido

1. Reverter release para ultimo commit estavel
2. Restaurar envs anteriores no provedor
3. Reexecutar health checks (`/api`, `/health`, `/ready`)
4. Validar checkout basico + login admin
5. Registrar incidente e causa raiz

---

## 14) Pendencias conhecidas

### Bloqueantes (resolver antes do go-live)
- Credenciais PagBank de producao configuradas e validadas
- BASE_URL com HTTPS real
- DATABASE_URL apontando para banco de producao

### Recomendadas antes do go-live
- Instalar `@sentry/node` e configurar `SENTRY_DSN`
- Definir `ADMIN_PASSWORD_HASH` (bcrypt) ao inves de texto plano
- Configurar backup automatico do banco

### Pos-go-live
- Ativar metricas (`METRICS_ENABLED=true`)
- Monitorar conversao de checkout
- Integrar Sentry no frontend (ErrorBoundary → @sentry/react)
- Avaliar CDN para assets estaticos
- Rotacao de JWT_SECRET periodica
