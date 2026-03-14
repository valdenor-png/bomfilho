# Deploy Vercel + Render (Passo a Passo)

## Visao geral

- Frontend React (Vite): Vercel
- Backend Node/Express: Render
- Banco de dados: MySQL externo (Railway, Hostinger, PlanetScale, etc.)

## 1) Preparar banco MySQL em nuvem

O backend usa `mysql2`, entao voce precisa de um host MySQL publico.

No banco novo, execute:

```sql
-- no cliente mysql
SOURCE backend/database.sql;
SOURCE backend/migrate_ofertas_v2.sql;
SOURCE backend/migrate_pix.sql;
SOURCE backend/migrate_produtos_codigo_barras_imagem.sql;
SOURCE backend/migrate_remover_favoritos_fidelidade.sql;
```

Se seu cliente SQL nao suportar `SOURCE`, rode cada arquivo manualmente.

## 2) Deploy do backend no Render

### Opcao A (recomendada): Blueprint com `render.yaml`

1. No Render, clique em **New +** -> **Blueprint**.
2. Conecte seu repositorio GitHub.
3. O Render vai detectar `render.yaml` e criar o servico `bomfilho-backend`.

### Opcao B: Web Service manual

- Root Directory: `backend`
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/ready`

### Variaveis obrigatorias no Render

Defina no painel do Render:

- `NODE_ENV=production`
- `SERVE_REACT=false`
- `TRUST_PROXY=true`
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=none`
- `JWT_SECRET=<chave com 32+ caracteres>`
- `RECAPTCHA_SECRET_KEY=<secret key do Google reCAPTCHA>`
- `RECAPTCHA_MIN_SCORE=0.5` (opcional, usado em respostas com score)
- `DATABASE_URL=mysql://USUARIO:SENHA@HOST:PORT/BANCO`
- `ADMIN_USER`, `ADMIN_PASSWORD`
- `ADMIN_LOCAL_ONLY=true` (seguro) ou `false` (se quiser admin remoto)
- `BASE_URL=https://SEU_BACKEND.onrender.com`
- `CORS_ORIGINS=https://SEU_FRONTEND.vercel.app`

Se usar pagamento/whatsapp:

- `PAGBANK_ENV`, `PAGBANK_TOKEN`, `PAGBANK_WEBHOOK_TOKEN`
- `PAGBANK_WEBHOOK_TOKEN` é obrigatório em produção (sem ele o backend não inicializa)
- Estrategia de webhook PagBank: o backend gera `notification_url` com `?token=...` e valida por query (ou por header `x-webhook-token` quando enviado)
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`

Diagnóstico remoto opcional (somente quando necessário):

- `ALLOW_REMOTE_DIAGNOSTIC=true`
- `DIAGNOSTIC_TOKEN=<token forte e aleatório>`

### Teste rapido do backend

```bash
curl https://SEU_BACKEND.onrender.com/ready
```

Esperado: status online.

## 3) Deploy do frontend na Vercel

1. No Vercel, clique em **Add New...** -> **Project**.
2. Importe o mesmo repositorio.
3. Configure:

- Framework Preset: `Vite`
- Root Directory: `frontend-react`
- Build Command: `npm run build`
- Output Directory: `dist`

4. Em **Environment Variables**, adicione:

- `VITE_API_URL=https://SEU_BACKEND.onrender.com`
- `VITE_RECAPTCHA_SITE_KEY=<site key do Google reCAPTCHA>`

5. Faça Deploy.

## 4) Pos-deploy (obrigatorio)

1. Copie a URL da Vercel (`https://SEU_FRONTEND.vercel.app`).
2. Volte no Render e atualize `CORS_ORIGINS` com essa URL.
3. No Render, re-deploy/restart do backend.
4. Teste no frontend:

- cadastro/login
- listar produtos
- criar pedido
- historico de pedidos

## 5) Checklist de producao

- [ ] Backend responde `GET /ready`
- [ ] Frontend abre sem erro de CORS
- [ ] Login/cadastro funcionando
- [ ] Pedido criado com sucesso
- [ ] Variaveis sensiveis so no painel (nao no Git)

## 6) Problemas comuns

### CORS bloqueando no navegador

- Verifique `CORS_ORIGINS` no Render.
- Deve conter exatamente a URL da Vercel, com `https://`.

### Sessao nao persiste

- Garanta:
  - `COOKIE_SECURE=true`
  - `COOKIE_SAME_SITE=none`
  - frontend usando `credentials: 'include'` (ja esta no projeto)

### Admin inacessivel

- Com `ADMIN_LOCAL_ONLY=true`, admin remoto retorna 403 por seguranca.
- Se quiser acessar admin pela internet, mude para `ADMIN_LOCAL_ONLY=false`.
