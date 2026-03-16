# Bom Filho Web

Plataforma web de supermercado com delivery local, focada em uma experiência de compra clara, rápida e confiável.

![Logo do projeto](img/logo-cupom.png)

## Visão Geral

O Bom Filho Web integra frontend e backend para oferecer um fluxo de compra completo:

- cadastro e login de clientes
- catálogo de produtos com busca e filtros
- carrinho e checkout em etapas
- pagamentos (PIX e opções na entrega)
- histórico e rastreamento de pedidos
- cupons e avaliações
- área administrativa de pedidos/produtos

O projeto foi estruturado para facilitar evolução contínua, com separação por módulos no frontend e API REST no backend.

## Direção atual: React no frontend + Node.js no backend

O padrão de evolução do projeto passa a ser:

- **Frontend principal em React** (`frontend-react`)
- **Backend em Node.js/Express** (`backend`)
- Em desenvolvimento, o Vite usa proxy para `/api`
- Em produção, o backend pode servir a build do React em `frontend-react/dist`

Essa arquitetura centraliza o desenvolvimento em JavaScript e preserva as rotas de API existentes.

### Rotas React atuais

- `/#/` catálogo e busca de produtos
- `/#/pagamento` carrinho, pedido e PIX
- `/#/conta` autenticação e perfil
- `/#/sobre` informações do negócio
- `/#/admin` painel administrativo (pedidos e produtos)
- `/#/politica-de-privacidade` política de privacidade
- `/#/termos-de-uso` termos de uso
- `/#/politica-de-troca-e-devolucao` política de troca e devolução
- `/#/politica-de-entrega` política de entrega

## Objetivo do projeto

Criar uma base sólida para um e-commerce de supermercado local, pronta para operação real e melhoria contínua.

## Principais funcionalidades

### Para o cliente

- 🔐 Autenticação com JWT
- 🛍️ Catálogo com categorias e busca inteligente
- 🧾 Carrinho de compras
- 🚚 Checkout com escolha de entrega/retirada
- 📍 Cálculo de frete por CEP
- 💳 Pagamento via PIX
- 🎟️ Validação de cupons
- 📦 Histórico e rastreamento de pedidos
- ⭐ Avaliação de produtos
- 📝 Listas de compras personalizadas

### Para operação/admin

- 🧰 Cadastro e remoção de produtos
- 📥 Importação em massa de produtos
- 📊 Visualização de pedidos
- 🔄 Atualização de status de pedidos

> Observação: funcionalidades de **favoritos** e **programa de fidelidade/pontos** foram removidas da versão atual.

## Imagens



## Arquitetura

### Frontend

- React + Vite em `frontend-react/` (principal)
- Frontend legado em `legacy/` (HTML/CSS/JS antigo para referência/compatibilidade)

### Backend

- Node.js + Express
- MySQL com `mysql2`
- Autenticação com JWT
- Senhas com `bcryptjs`
- CORS e endpoints REST

## Estrutura do projeto

```text
site/
├── legacy/
│   ├── index.html
│   ├── styles.css
│   ├── api-config.js
│   ├── admin.html
│   ├── admin-pedidos.html
│   ├── painel-admin.html
│   ├── css/
│   └── js/
├── frontend-react/
│   ├── src/
│   │   └── pages/
│   │       ├── HomePage.jsx
│   │       ├── PagamentoPage.jsx
│   │       ├── ContaPage.jsx
│   │       ├── SobrePage.jsx
│   │       └── AdminPage.jsx
│   └── dist/
├── img/
├── docs/
├── scripts/
└── backend/
	├── server.js
	├── database.sql
	├── package.json
	└── migrations (*.sql)
```

## Tecnologias utilizadas

### Frontend

- React + Vite (principal)
- HTML/CSS/JS legado em `legacy/`
- Node.js 18+ (recomendado para build/deploy)

### Backend

- Node.js
- Express
- MySQL
- JWT
- bcryptjs
- Node.js 18+ (recomendado para runtime/deploy)

## Como rodar localmente

### 1) Banco de dados

Crie o banco e execute os scripts SQL da pasta `backend/`.

### 2) Instalação do backend

```bash
cd backend
npm install
```

### 3) Variáveis de ambiente

Crie/configure um arquivo `.env` no backend com:

```env
DATABASE_URL=mysql://root:sua_senha@localhost:3306/railway
PORT=3000
JWT_SECRET=sua_chave_secreta_com_32_ou_mais_caracteres
BASE_URL=http://localhost:3000
PAGBANK_WEBHOOK_TOKEN=token_grande_e_aleatorio
```

### 4) Iniciar backend

```bash
npm run dev
# ou
npm start
```

### 5) Iniciar frontend (React)

Opcional: crie `frontend-react/.env.local` para desenvolvimento local:

```env
VITE_API_URL=http://localhost:3000
```

```bash
cd frontend-react
npm install
npm run dev
```

Abra: `http://127.0.0.1:5173`

> Alternativa rápida (Windows): `scripts/start-servicos.bat`

Para deploy no Vercel (monorepo), configure Root Directory como `frontend-react`.

### 6) Produção com Node servindo React

```bash
cd frontend-react
npm run build

cd ../backend
npm start
```

Com a build gerada, o backend serve o frontend React no mesmo host/porta da API.

## Endpoints principais da API

### Autenticação

- `POST /api/auth/cadastro`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/usuario/whatsapp`

### Endereço

- `GET /api/endereco`
- `POST /api/endereco`

### Produtos

- `GET /api/produtos`
- `GET /api/produtos/:id`

### Pedidos

- `POST /api/pedidos`
- `GET /api/pedidos`
- `GET /api/pedidos/:id`

### Cupons e avaliações

- `POST /api/cupons/validar`
- `GET /api/cupons/disponiveis`
- `GET /api/avaliacoes/:produto_id`
- `POST /api/avaliacoes`

### Pagamentos e webhooks

- `GET /api/pagbank/public-key`
- `GET /api/pagbank/status`
- `POST /api/pagbank/test-pix`
- `POST /api/pagamentos/pix`
- `POST /api/pagamentos/cartao`
- `POST /api/webhooks/pagbank`

## Segurança

- Senhas protegidas com hash (`bcryptjs`)
- Sessão autenticada por token JWT
- Rotas sensíveis protegidas por middleware de autenticação
- Uso de consultas parametrizadas no MySQL

## Qualidade e validação

O projeto inclui documentação e scripts de apoio para testes e manutenção em `docs/` e `scripts/`.

Documentos operacionais importantes:

- `docs/GO_LIVE_TECNICO_CHECKLIST.md`
- `docs/OPERACAO_ADMIN_PEDIDOS_PAGAMENTOS.md`

## Roadmap (resumo)

- melhorar mídia real dos produtos
- evoluir métricas de conversão no checkout
- ampliar automações operacionais no painel admin
- fortalecer monitoramento de erros e logs

## Contribuição

Contribuições são bem-vindas para melhorias técnicas, visuais e de processo. A recomendação é trabalhar em branch própria e abrir PR com descrição clara das mudanças.

## Licença

Projeto de uso educacional e operacional interno.
