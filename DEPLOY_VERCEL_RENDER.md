# Deploy Vercel + Render (Passo a Passo)

## Visao geral

- Frontend React (Vite): Vercel
- Backend Node/Express: Render
- Banco de dados: MySQL externo (Railway, Hostinger, PlanetScale, etc.)

## 1) Preparar banco MySQL em nuvem

O backend usa `mysql2`, entao voce precisa de um host MySQL publico.

No banco novo, execute:

```sql
SOURCE backend/database.sql;
SOURCE backend/migrate_ofertas_v2.sql;
SOURCE backend/migrate_pix.sql;
SOURCE backend/migrate_produtos_codigo_barras_imagem.sql;
SOURCE backend/migrate_remover_favoritos_fidelidade.sql;
```

## 2) Deploy do backend no Render

### Opcao A: Blueprint (recomendada)

1. No Render, clique em **New +** -> **Blueprint**.
2. Conecte o repositorio GitHub.
3. O Render vai usar `render.yaml` automaticamente.

### Variaveis obrigatorias no Render

- `NODE_ENV=production`
- `SERVE_REACT=false`
- `TRUST_PROXY=true`
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=none`
- `JWT_SECRET=<chave forte com 32+ caracteres>`
- `RECAPTCHA_SECRET_KEY=<secret key do Google reCAPTCHA>`
- `RECAPTCHA_MIN_SCORE=0.5` (opcional, usado em respostas com score)
- `DATABASE_URL=mysql://USUARIO:SENHA@HOST:PORT/BANCO`
- `ADMIN_USER`, `ADMIN_PASSWORD`
- `ADMIN_LOCAL_ONLY=true` (seguro) ou `false` (admin remoto)
- `BASE_URL=https://SEU_BACKEND.onrender.com`
- `CORS_ORIGINS=https://SEU_FRONTEND.vercel.app`

Se usar PIX/WhatsApp:

- `PAGBANK_ENV`, `PAGBANK_TOKEN`, `PAGBANK_PUBLIC_KEY`, `PAGBANK_WEBHOOK_TOKEN`
- `PAGBANK_DEBUG_LOGS=true` (recomendado para homologacao)
- `ALLOW_PIX_MOCK=false` (recomendado para homologacao real)
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`

Teste rapido:

```bash
curl https://SEU_BACKEND.onrender.com/api
```

## 3) Deploy do frontend na Vercel

1. Vercel -> **Add New...** -> **Project**.
2. Importe o mesmo repositorio.
3. Configure:

- Framework: `Vite`
- Root Directory: `frontend-react`
- Build: `npm run build`
- Output: `dist`

4. Env var na Vercel:

- `VITE_API_URL=https://SEU_BACKEND.onrender.com`
- `VITE_RECAPTCHA_SITE_KEY=<site key do Google reCAPTCHA>`

5. Deploy.

## 4) Pos-deploy

1. Copie a URL da Vercel (`https://SEU_FRONTEND.vercel.app`).
2. Atualize `CORS_ORIGINS` no Render com essa URL.
3. Reinicie/redeploy do backend no Render.
4. Teste login, produtos e criacao de pedido.

## 5) Checklist rapido

- [ ] Backend responde `GET /api`
- [ ] Frontend abre sem erro de CORS
- [ ] Login/cadastro funcionando
- [ ] Pedido funcionando
- [ ] Variaveis sensiveis somente no painel
