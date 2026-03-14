# Deploy Vercel + Render (Passo a Passo)

## Visão geral

- Frontend React (Vite): Vercel
- Backend Node/Express: Render
- Banco de dados: MySQL externo (Railway, Hostinger, PlanetScale etc.)
- Node.js recomendado: 18+

## 1) Preparar banco MySQL em nuvem

O backend utiliza mysql2, então é necessário um host MySQL público.

No banco novo, execute:

```sql
SOURCE backend/database.sql;
SOURCE backend/migrate_ofertas_v2.sql;
SOURCE backend/migrate_pix.sql;
SOURCE backend/migrate_produtos_codigo_barras_imagem.sql;
SOURCE backend/migrate_remover_favoritos_fidelidade.sql;
```

## 2) Deploy do backend no Render

### Opção A: Blueprint (recomendada)

1. No Render, clique em New + e selecione Blueprint.
2. Conecte o repositório do GitHub.
3. O Render detecta automaticamente o arquivo render.yaml.

### Variáveis obrigatórias no Render

- NODE_ENV=production
- SERVE_REACT=false
- TRUST_PROXY=true
- COOKIE_SECURE=true
- COOKIE_SAME_SITE=none
- NODE_VERSION=20 (recomendado)
- JWT_SECRET=<chave forte com 32+ caracteres>
- RECAPTCHA_SECRET_KEY=<secret key do Google reCAPTCHA>
- RECAPTCHA_MIN_SCORE=0.5 (opcional)
- DATABASE_URL=mysql://USUARIO:SENHA@HOST:PORT/BANCO
- ADMIN_USER e ADMIN_PASSWORD
- ADMIN_LOCAL_ONLY=true (mais seguro) ou false (admin remoto)
- BASE_URL=https://SEU_BACKEND.onrender.com
- CORS_ORIGINS=https://SEU_FRONTEND.vercel.app
- FRONTEND_APP_URL=https://SEU_FRONTEND.vercel.app (opcional, recomendado)

Se utilizar PIX e WhatsApp:

- PAGBANK_ENV, PAGBANK_TOKEN, PAGBANK_PUBLIC_KEY, PAGBANK_WEBHOOK_TOKEN
- PAGBANK_WEBHOOK_TOKEN é obrigatório em produção (o backend não inicializa sem essa variável)
- Estratégia de webhook PagBank: o backend gera `notification_url` com `?token=...` e valida o token por query (ou por header `x-webhook-token` quando enviado)
- PAGBANK_DEBUG_LOGS=true (recomendado em homologação)
- ALLOW_PIX_MOCK=false (recomendado em homologação real)
- ALLOW_DEBIT_3DS_MOCK=false (produção/homologação real deve usar 3DS real)
- EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE

Diagnóstico remoto opcional (somente quando necessário):

- ALLOW_REMOTE_DIAGNOSTIC=true
- DIAGNOSTIC_TOKEN=<token forte e aleatório>

Teste rápido:

```bash
curl https://SEU_BACKEND.onrender.com/api
curl https://SEU_BACKEND.onrender.com/ready
```

## 3) Deploy do frontend na Vercel

1. Na Vercel, clique em Add New e selecione Project.
2. Importe o mesmo repositório.
3. Configure:

- Framework: Vite
- Root Directory: frontend-react
- Install Command: npm ci
- Build Command: npm run build
- Output Directory: dist
- Production Branch: main (deploy automático a cada push)

Observação: o arquivo `frontend-react/vercel.json` versiona esses comandos para reduzir erro manual.

4. Configure as variáveis de ambiente na Vercel:

- VITE_API_URL=https://SEU_BACKEND.onrender.com
- VITE_RECAPTCHA_SITE_KEY=<site key do Google reCAPTCHA>

Importante: em produção não use `localhost` no `VITE_API_URL`.

5. Execute o deploy.

## 4) Pós-deploy

1. Copie a URL da Vercel (exemplo: https://SEU_FRONTEND.vercel.app).
2. Atualize CORS_ORIGINS no Render com a URL exata do frontend.
3. Reinicie/redeploy o backend no Render.
4. Valide os fluxos de login, produtos e criação de pedido.

## 5) Checklist rápido

- [ ] Backend responde GET /ready
- [ ] Frontend abre sem erro de CORS
- [ ] Frontend com Root Directory em frontend-react
- [ ] Deploy automático da Vercel na branch main
- [ ] Login e cadastro funcionando
- [ ] Criação de pedido funcionando
- [ ] Variáveis sensíveis configuradas apenas no painel
