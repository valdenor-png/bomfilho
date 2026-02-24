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
DB_NAME=bom_filho_db
DB_PORT=3306

PORT=3000

JWT_SECRET=sua_chave_secreta_muito_segura

# PagBank (PIX)
PAGBANK_ENV=sandbox
PAGBANK_TOKEN=SEU_TOKEN_PAGBANK
BASE_URL=https://SUA_URL_PUBLICA
```

## 💠 PIX automático (PagBank)

O fluxo do PIX automático funciona assim:

- Ao criar o pedido com `forma_pagamento = pix`, o backend cria uma cobrança PIX no PagBank e devolve `pix_codigo`/`pix_qrcode`.
- Quando o cliente paga, o PagBank chama o webhook `POST /api/webhooks/pagbank` e o backend atualiza o status do pedido para `pago`.

Para isso funcionar em ambiente local, o webhook precisa ser acessível publicamente.

### 1) Preencher variáveis no `.env`

- `PAGBANK_TOKEN`: token do Portal PagBank
- `PAGBANK_ENV`: `sandbox` (teste) ou `production`
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
  "telefone": "(11) 99999-9999"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "joao@email.com",
  "senha": "senha123"
}
```

Retorna: `{ token: "...", usuario: {...} }`

#### Dados do usuário logado
```http
GET /api/auth/me
Authorization: Bearer SEU_TOKEN_JWT
```

### Endereços

#### Obter endereço
```http
GET /api/endereco
Authorization: Bearer SEU_TOKEN_JWT
```

#### Salvar/Atualizar endereço
```http
POST /api/endereco
Authorization: Bearer SEU_TOKEN_JWT
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
Authorization: Bearer SEU_TOKEN_JWT
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
Authorization: Bearer SEU_TOKEN_JWT
```

#### Detalhes de um pedido
```http
GET /api/pedidos/1
Authorization: Bearer SEU_TOKEN_JWT
```

## 🔒 Segurança

- Senhas criptografadas com bcryptjs
- Autenticação via JWT (JSON Web Tokens)
- CORS habilitado para requisições do frontend
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

- O token JWT expira em 7 dias
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
