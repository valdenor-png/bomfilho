# 🛒 BOM FILHO SUPERMERCADO - Backend API

Backend completo com Node.js, Express e MySQL para o supermercado Bom Filho.

## 📋 Pré-requisitos

- Node.js (v14 ou superior)
- MySQL (v5.7 ou superior)
- NPM ou Yarn

## 🚀 Instalação

### 1. Instalar dependências

```bash
cd backend
npm install
```

### 2. Configurar banco de dados

1. Abra o MySQL Workbench ou linha de comando do MySQL
2. Execute o script `database.sql` para criar o banco e as tabelas:

```bash
mysql -u root -p < database.sql
```

Ou copie e execute o conteúdo do arquivo no MySQL Workbench.

### 3. Configurar variáveis de ambiente

1. Copie o arquivo `.env.example` para `.env`:
```bash
copy .env.example .env
```

2. Edite o arquivo `.env` com suas configurações:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=railway
DB_PORT=3306

PORT=3000

# CORS (origens permitidas, separadas por vírgula)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Se estiver atrás de proxy reverso confiável (Nginx/Cloudflare)
TRUST_PROXY=false

# Cookies de sessão (HttpOnly)
# Em produção HTTPS, use true
COOKIE_SECURE=false
# strict | lax | none
# Para frontend em outro domínio (Vercel + Render), use none
COOKIE_SAME_SITE=strict
# Opcional: domínio dos cookies (ex: .seusite.com)
COOKIE_DOMAIN=

JWT_SECRET=sua_chave_secreta_muito_segura

# Google reCAPTCHA (opcional, recomendado para login/cadastro)
RECAPTCHA_SECRET_KEY=
# Usado apenas com reCAPTCHA v3 (0 a 1)
RECAPTCHA_MIN_SCORE=0.5

# Proteção opcional para rotas de diagnóstico
DIAGNOSTIC_TOKEN=

# PagBank (PIX + Cartao)
PAGBANK_ENV=sandbox
PAGBANK_TOKEN=SEU_TOKEN_PAGBANK
PAGBANK_PUBLIC_KEY=SUA_CHAVE_PUBLICA_PAGBANK

# Proteção do webhook PagBank
PAGBANK_WEBHOOK_TOKEN=troque_por_um_token_grande_e_aleatorio
BASE_URL=https://SUA_URL_PUBLICA

# Evolution API (WhatsApp)
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=SUA_CHAVE_EVOLUTION
EVOLUTION_INSTANCE=loja
EVOLUTION_WEBHOOK_TOKEN=troque_por_um_token_grande_e_aleatorio

# Auto-resposta para mensagens recebidas no WhatsApp
WHATSAPP_AUTO_REPLY_ENABLED=false
WHATSAPP_AUTO_REPLY_TEXT=Estamos com o site do Bom Filho no ar. Faca seu pedido por la.
WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS=0
```

## 💠 PIX automático (PagBank)

O fluxo do PIX automático funciona assim:

- Ao criar o pedido com `forma_pagamento = pix`, o backend cria uma cobrança PIX no PagBank e devolve `pix_codigo`/`pix_qrcode`.
- Quando o cliente paga, o PagBank chama o webhook `POST /api/webhooks/pagbank` e o backend atualiza o status do pedido para `pago`.

Para isso funcionar em ambiente local, o webhook precisa ser acessível publicamente.

### 1) Preencher variáveis no `.env`

- `PAGBANK_TOKEN`: token do Portal PagBank
- `PAGBANK_ENV`: `sandbox` (teste) ou `production`
- `PAGBANK_PUBLIC_KEY`: chave pública usada para criptografar cartão no frontend
- `BASE_URL`: URL pública do seu backend (ex.: ngrok/Cloudflare Tunnel)

### 2) Rodar migração do PIX no MySQL

Execute o arquivo `migrate_pix.sql` para adicionar colunas de PIX na tabela `pedidos`.

### 3) Expor o webhook (se estiver em localhost)

Exemplo com ngrok (porta 3000):

```bash
ngrok http 3000
```

Depois, coloque a URL HTTPS que o ngrok gerar em `BASE_URL`.

### 3.1) (Opcional) Testar se o token PagBank está OK

Com o backend rodando, você pode validar rapidamente se a credencial está aceitando autenticação:

```http
GET /api/pagbank/status
```

Ele retorna `auth_check` com `ok=true/false` e também mostra qual `webhook_url` está sendo usado.

### 3.2) (Opcional) Expor chave publica para checkout com cartao

```http
GET /api/pagbank/public-key
```

Retorna a chave pública (`public_key`) e URL do SDK para criptografia do cartão via `PagSeguro.encryptCard`.

## 💬 Auto-resposta no WhatsApp (Evolution)

Quando o webhook da Evolution estiver configurado, o backend pode responder automaticamente
sempre que um cliente enviar mensagem para o numero da loja.

### 1) Ative no `.env`

- `WHATSAPP_AUTO_REPLY_ENABLED=true`
- `WHATSAPP_AUTO_REPLY_TEXT=Estamos com o site do Bom Filho no ar. Faca seu pedido por la.`
- Opcional: `WHATSAPP_AUTO_REPLY_COOLDOWN_SECONDS=30`

### 2) Configure o webhook na Evolution

- URL: `https://SUA_URL_PUBLICA/api/webhooks/evolution`
- Método: `POST`
- Token (opcional): use o mesmo valor de `EVOLUTION_WEBHOOK_TOKEN`

### 3) Observações

- O backend ignora mensagens enviadas pelo proprio bot (`fromMe`) para evitar loop.
- Mensagens em grupos/broadcast tambem sao ignoradas.

### 4. Iniciar o servidor

**Modo desenvolvimento (com auto-reload):**
```bash
npm run dev
```

**Modo produção:**
```bash
npm start
```

O servidor estará rodando em: `http://localhost:3000`

## 📚 Endpoints da API

### Autenticação

#### Cadastro
```http
POST /api/auth/cadastro
Content-Type: application/json

{
  "nome": "João Silva",
  "email": "joao@email.com",
  "senha": "senha123",
  "telefone": "(11) 99999-9999",
  "recaptcha_token": "TOKEN_GERADO_NO_FRONT"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "joao@email.com",
  "senha": "senha123",
  "recaptcha_token": "TOKEN_GERADO_NO_FRONT"
}
```

Se `RECAPTCHA_SECRET_KEY` estiver preenchido no backend, `recaptcha_token` passa a ser obrigatório em login e cadastro.

Retorna: `{ usuario: {...}, csrfToken: "..." }` e define cookie HttpOnly de sessão.

#### Token CSRF
```http
GET /api/auth/csrf
```

Retorna: `{ csrfToken: "..." }` e define cookie CSRF.

#### Logout
```http
POST /api/auth/logout
x-csrf-token: TOKEN_CSRF
```

#### Dados do usuário logado
```http
GET /api/auth/me
```

### Endereços

#### Obter endereço
```http
GET /api/endereco
```

#### Salvar/Atualizar endereço
```http
POST /api/endereco
x-csrf-token: TOKEN_CSRF
Content-Type: application/json

{
  "rua": "Rua das Flores",
  "numero": "123",
  "bairro": "Centro",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01234-567"
}
```

### Produtos

#### Listar produtos
```http
GET /api/produtos
```

#### Buscar produto por ID
```http
GET /api/produtos/1
```

### Pedidos

#### Criar pedido
```http
POST /api/pedidos
x-csrf-token: TOKEN_CSRF
Content-Type: application/json

{
  "itens": [
    {
      "produto_id": 1,
      "nome": "Banana",
      "preco": 4.99,
      "quantidade": 2
    },
    {
      "produto_id": 2,
      "nome": "Leite",
      "preco": 3.50,
      "quantidade": 1
    }
  ]
}
```

#### Listar pedidos do usuário
```http
GET /api/pedidos
```

#### Detalhes de um pedido
```http
GET /api/pedidos/1
```

### Pagamentos

#### Gerar/atualizar PIX
```http
POST /api/pagamentos/pix
x-csrf-token: TOKEN_CSRF
Content-Type: application/json

{
  "pedido_id": 123,
  "tax_id": "12345678909"
}
```

#### Pagar com cartão (API Orders)
```http
POST /api/pagamentos/cartao
x-csrf-token: TOKEN_CSRF
Content-Type: application/json

{
  "pedido_id": 123,
  "tax_id": "12345678909",
  "token_cartao": "TOKEN_OU_CARTAO_CRIPTOGRAFADO_PAGBANK",
  "tipo_cartao": "credito",
  "parcelas": 1
}
```

`tipo_cartao` aceito: `credito` ou `debito`.

Para `debito`, envie `parcelas=1`.

#### Webhook PagBank
```http
POST /api/webhooks/pagbank
```

## 🔒 Segurança

- Senhas criptografadas com bcryptjs
- Autenticação via JWT armazenado em cookie HttpOnly
- Proteção CSRF com validação de cookie + header `x-csrf-token`
- CORS com allowlist de origens e `credentials`
- Rate limit para API e endpoints sensíveis
- Proteções para webhook/diagnóstico por token dedicado
- Prepared statements para prevenir SQL Injection

## 📦 Dependências

- **express**: Framework web
- **mysql2**: Cliente MySQL com suporte a promises
- **bcryptjs**: Criptografia de senhas
- **jsonwebtoken**: Autenticação JWT
- **cors**: Cross-Origin Resource Sharing
- **dotenv**: Variáveis de ambiente
- **body-parser**: Parse de requisições JSON

## 🛠️ Estrutura do Banco

### Tabelas:
- `usuarios` - Dados dos usuários
- `enderecos` - Endereços de entrega
- `produtos` - Catálogo de produtos
- `pedidos` - Pedidos realizados
- `pedido_itens` - Itens de cada pedido

## 📝 Notas

- Sessão do cliente expira em 7 dias (cookie HttpOnly)
- Sessão do admin expira em 12 horas (cookie HttpOnly)
- Produtos inativos não aparecem na listagem
- Pedidos iniciam com status "pendente"
- Relacionamentos CASCADE para deleções

## 🐛 Troubleshooting

### Erro de conexão com MySQL
- Verifique se o MySQL está rodando
- Confirme usuário e senha no arquivo `.env`
- Teste a conexão: `mysql -u root -p`

### Porta 3000 em uso
- Altere a porta no arquivo `.env`
- Ou finalize o processo que está usando a porta

## 📧 Suporte

Para dúvidas ou problemas, consulte a documentação ou entre em contato.

