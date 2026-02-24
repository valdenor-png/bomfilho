# 🛒 BOM FILHO SUPERMERCADO

Sistema completo de e-commerce para supermercado com frontend e backend integrados.

## ✨ Funcionalidades Implementadas

### Funcionalidades Ativas

1. **📋 Histórico de Compras**
   - Visualizar pedidos anteriores
   - Detalhes de cada pedido
   - Função "Comprar Novamente"
   - Status de pedidos

2. **🎟️ Sistema de Cupons**
   - 5 cupons de desconto disponíveis
   - Validação de cupons
   - Aplicação de desconto no checkout
   - Cupons de uso único

3. **🚚 Rastreamento de Pedidos**
   - Timeline visual com 4 estágios
   - Animações de progresso
   - Modal interativo
   - Código de rastreamento

4. **🔍 Busca Inteligente**
   - Autocomplete com sugestões
   - Navegação por teclado (↑↓ Enter Esc)
   - Debounce de 300ms
   - Destaque de texto correspondente

5. **📝 Listas de Compras Personalizadas**
   - Criar múltiplas listas
   - 8 emojis para categorizar
   - Controle de quantidades
   - Adicionar lista inteira ao carrinho

6. **🏷️ Produtos em Oferta/Destaque**
   - Seção especial de ofertas
   - Badges de desconto
   - Preços riscados
   - Cálculo automático de descontos

7. **⭐ Sistema de Avaliações**
   - Avaliar produtos (1-5 estrelas)
   - Comentários opcionais
   - Média de avaliações
   - Botão "Avaliar" em cada produto

8. **📦 Calcular Frete por CEP**
   - Simulação de frete baseada no CEP
   - Prazo de entrega
   - Tipos de frete (PAC)
   - Integrado ao carrinho

\* **Removidos do projeto:** Favoritos e Programa de Pontos/Fidelidade

### Recursos Adicionais
- 📱 Design responsivo mobile-first
- 🎨 Carrossel de promoções com 4 slides
- 🔐 Sistema de autenticação JWT
- 💳 Checkout com PIX ou dinheiro na entrega
- 📍 Gerenciamento de endereços
- 📊 17 produtos com descrições completas

## 📁 Estrutura do Projeto

```
site/
├── backend/
│   ├── server.js                         # Servidor Node.js com Express + rotas
│   ├── database.sql                      # Schema completo do banco
│   ├── migrate_ofertas_v2.sql           # Migration de ofertas/avaliações/pontos
│   ├── update_produtos_existentes.sql   # Atualização de produtos
│   ├── package.json                      # Dependências do backend
│   └── .env                              # Configurações do banco
├── js/
│   ├── auth.js                           # Autenticação e login
│   ├── cart.js                           # Carrinho de compras
│   ├── carousel.js                       # Carrossel de promoções
│   ├── (removido) favoritos.js
│   ├── historico-cupons.js               # Histórico e cupons
│   ├── rastreamento.js                   # Rastreamento de pedidos
│   ├── busca.js                          # Busca inteligente
│   ├── listas.js                         # Listas de compras
│   ├── ofertas-avaliacoes.js             # Ofertas, avaliações e frete
│   ├── products.js                       # Gerenciamento de produtos
│   └── main.js                           # Inicialização
├── index.html                            # Página principal
├── api-config.js                         # Configuração da API
├── styles.css                            # Estilos CSS (~1500 linhas)
└── README.md                             # Esta documentação
```

## 🚀 Como Executar o Projeto

### 1. Configurar o Banco de Dados

```bash
# Entre no MySQL
mysql -u root -p

# Execute o script de criação do banco
source backend/database.sql

# Execute as migrations
source backend/migrate_ofertas_v2.sql
source backend/update_produtos_existentes.sql
```

### 2. Instalar Dependências do Backend

```bash
cd backend
npm install
```

### 3. Configurar Variáveis de Ambiente

Edite o arquivo `backend/.env` com suas credenciais do MySQL:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=bom_filho_db
DB_PORT=3306
PORT=3000
JWT_SECRET=sua_chave_secreta_segura
```

### 4. Iniciar o Servidor Backend

```bash
# Modo desenvolvimento (com auto-reload)
npm run dev

# Ou modo produção
npm start
```

O servidor estará rodando em: `http://localhost:3000`

### 5. Abrir o Frontend

Abra o arquivo `index.html` em um navegador:

```bash
# Windows
start index.html

# Linux/Mac
open index.html

# Ou use um servidor local
python -m http.server 8080
```

Acesse: `http://localhost:8080` ou abra `index.html` diretamente

## 🎯 Endpoints da API

### Autenticação
- `POST /api/auth/cadastro` - Cadastrar usuário
- `POST /api/auth/login` - Fazer login
- `GET /api/auth/me` - Obter dados do usuário (requer token)

### Produtos
- `GET /api/produtos` - Listar todos os produtos (inclui em_oferta e desconto_percentual)
- `GET /api/produtos/:id` - Detalhes de um produto

### Pedidos
- `POST /api/pedidos` - Criar pedido
- `GET /api/pedidos` - Listar pedidos do usuário
- `GET /api/pedidos/:id` - Detalhes de um pedido

### Cupons
- `GET /api/cupons` - Listar cupons disponíveis
- `POST /api/cupons/validar` - Validar cupom

### Avaliações ⭐ NOVO
- `GET /api/avaliacoes/:produto_id` - Listar avaliações de um produto
- `POST /api/avaliacoes` - Criar/atualizar avaliação (requer login)

## 💾 Estrutura do Banco de Dados

### Tabelas Principais
- **usuarios** - Dados de login e cadastro
- **produtos** - Catálogo com campos: desconto_percentual, em_oferta
- **pedidos** - Histórico de compras
- **pedido_itens** - Itens de cada pedido
- **cupons** - Cupons de desconto
- **cupons_usados** - Controle de uso de cupons
- **avaliacoes** ⭐ NOVO - Avaliações de produtos (1-5 estrelas + comentário)

## 📱 Como Usar as Novas Funcionalidades

### Sistema de Ofertas
1. Produtos em oferta aparecem na seção **"🏷️ Ofertas Especiais"** no topo
2. Badges de desconto aparecem nos cards
3. Preços originais aparecem riscados
4. Desconto é aplicado automaticamente

### Sistema de Avaliações
1. Clique em **"⭐ Avaliar"** em qualquer produto
2. Selecione de 1 a 5 estrelas
3. Adicione um comentário (opcional)
4. Publique sua avaliação
5. Veja a média de avaliações dos produtos

### Calcular Frete
1. Adicione produtos ao carrinho
2. Na tela do carrinho, insira seu CEP
3. Clique em **"Calcular"**
4. Veja o valor e prazo de entrega
5. O frete é adicionado automaticamente ao total

### Programa de Pontos
1. Faça login
2. Veja seus pontos no botão **🎁** do header
3. A cada R$ 10 em compras, ganhe 1 ponto
4. 100 pontos = R$ 10 de desconto
5. Clique no botão para ver o histórico completo

### 📦 Sistema de Pedidos
- Finalização de compra
- Salvamento no banco de dados
- Histórico completo

## 📚 Tecnologias Utilizadas

### Frontend
- HTML5
- CSS3
- JavaScript (Vanilla)
- Fetch API

### Backend
- Node.js
- Express.js
- MySQL
- JWT (autenticação)
- Bcrypt (criptografia de senhas)

## 🔒 Segurança

- Senhas criptografadas com bcryptjs
- Autenticação via JWT
- Proteção contra SQL Injection
- CORS configurado

## 📝 Endpoints da API

### Autenticação
- `POST /api/auth/cadastro` - Criar conta
- `POST /api/auth/login` - Fazer login
- `GET /api/auth/me` - Dados do usuário logado

### Produtos
- `GET /api/produtos` - Listar produtos
- `GET /api/produtos/:id` - Detalhes do produto

### Endereços
- `GET /api/endereco` - Obter endereço
- `POST /api/endereco` - Salvar endereço

### Pedidos
- `POST /api/pedidos` - Criar pedido
- `GET /api/pedidos` - Listar pedidos
- `GET /api/pedidos/:id` - Detalhes do pedido

## 🐛 Troubleshooting

### Erro: "Erro ao carregar produtos"
- Verifique se o backend está rodando
- Confirme a URL da API em `api-config.js`
- Verifique o console do navegador

### Erro de conexão com MySQL
- Confirme que o MySQL está rodando
- Verifique as credenciais no `.env`
- Execute o script `database.sql`

### CORS Error
- Verifique se o backend está configurado para aceitar requisições do frontend
- O CORS já está habilitado no `server.js`

## 📦 Banco de Dados

### Tabelas
- `usuarios` - Dados dos usuários
- `enderecos` - Endereços de entrega
- `produtos` - Catálogo de produtos
- `pedidos` - Pedidos realizados
- `pedido_itens` - Itens de cada pedido

## 🎯 Próximas Melhorias

- [ ] Adicionar imagens reais dos produtos
- [ ] Implementar carrinho com quantidade
- [ ] Sistema de pagamento
- [ ] Rastreamento de entrega
- [ ] Painel administrativo
- [ ] Notificações por e-mail

## 📄 Licença

Projeto educacional - Livre para uso e modificação.
