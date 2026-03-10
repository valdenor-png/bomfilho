# 🛒 Bom Filho Web

Sistema web completo para supermercado e delivery local, com experiência de compra focada em simplicidade, velocidade e operação real.

![Logo do projeto](img/logo-cupom.png)

## 📌 Visão Geral

O **Bom Filho Web** integra frontend e backend para oferecer um fluxo de compra completo:

- cadastro e login de clientes
- catálogo de produtos com busca e filtros
- carrinho e checkout em etapas
- pagamentos (PIX e opções na entrega)
- histórico e rastreamento de pedidos
- cupons e avaliações
- área administrativa de pedidos/produtos

O projeto foi estruturado para ser **fácil de evoluir**, com separação por módulos no frontend e uma API REST no backend.

## ✅ Direção atual: React no frontend + Node.js no backend

O padrão de evolução do projeto passa a ser:

- **Frontend principal em React** (`frontend-react`)
- **Backend em Node.js/Express** (`backend`)
- Em desenvolvimento, o Vite usa proxy para `/api`
- Em produção, o backend pode servir a build do React em `frontend-react/dist`

Isso permite centralizar tudo em JavaScript, mantendo as rotas de API já existentes.

### Rotas React atuais

- `/#/` catálogo e busca de produtos
- `/#/pagamento` carrinho, pedido e PIX
- `/#/conta` autenticação e perfil
- `/#/sobre` informações do negócio
- `/#/admin` painel administrativo (pedidos e produtos)

## 🧭 Objetivo do Projeto

Criar uma base sólida para um e-commerce de supermercado local, pronta para uso prático e melhoria contínua, sem depender de frameworks complexos no frontend.

## ✨ Principais Funcionalidades

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

## 🖼️ Imagens



## 🏗️ Arquitetura

### Frontend

- React + Vite em `frontend-react/` (principal)
- Frontend legado em `legacy/` (HTML/CSS/JS antigo para referência/compatibilidade)

### Backend

- Node.js + Express
- MySQL com `mysql2`
- Autenticação com JWT
- Senhas com `bcryptjs`
- CORS e endpoints REST

## 🗂️ Estrutura do Projeto

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

## ⚙️ Tecnologias Utilizadas

### Frontend

- React + Vite (principal)
- HTML/CSS/JS legado em `legacy/`

### Backend

- Node.js
- Express
- MySQL
- JWT
- bcryptjs

## 🚀 Como Rodar Localmente

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
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=railway
DB_PORT=3306
PORT=3000
JWT_SECRET=sua_chave_secreta
```

### 4) Iniciar backend

```bash
npm run dev
# ou
npm start
```

### 5) Iniciar frontend (React)

```bash
cd frontend-react
npm install
npm run dev
```

Abra: `http://127.0.0.1:5173`

> Alternativa rápida (Windows): `scripts/start-servicos.bat`

### 6) Produção com Node servindo React

```bash
cd frontend-react
npm run build

cd ../backend
npm start
```

Com a build gerada, o backend serve o frontend React no mesmo host/porta da API.

## 🔌 Endpoints Principais da API

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

## 🔒 Segurança

- Senhas protegidas com hash (`bcryptjs`)
- Sessão autenticada por token JWT
- Rotas sensíveis protegidas por middleware de autenticação
- Uso de consultas parametrizadas no MySQL

## 🧪 Qualidade e Validação

O projeto inclui documentação e scripts de apoio para testes e manutenção em `docs/` e `scripts/`.

## 🛣️ Roadmap (Resumo)

- melhorar mídia real dos produtos
- evoluir métricas de conversão no checkout
- ampliar automações operacionais no painel admin
- fortalecer monitoramento de erros e logs

## 🤝 Contribuição

Contribuições são bem-vindas para melhorias técnicas, visuais e de processo. A recomendação é trabalhar em branch própria e abrir PR com descrição clara das mudanças.

## 📄 Licença

Projeto de uso educacional e operacional interno.
