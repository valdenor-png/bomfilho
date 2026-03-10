# 🧠 CONTEXTO DO PROJETO - BOM FILHO SUPERMERCADO

## 📋 Informações para IA/Desenvolvedor

Este arquivo ajuda a entender rapidamente o projeto quando trabalhar em outra máquina.

---

## 🎯 **Sobre o Projeto**

**Nome:** Bom Filho Supermercado  
**Tipo:** E-commerce completo (Frontend + Backend + Banco de Dados)  
**Status:** 80% completo, pronto para deploy  
**Tecnologias:** React (Vite), Node.js, Express, MySQL, HTML/CSS/JS (legado)

---

## 🏗️ **Arquitetura**

### **Frontend principal (React)**
```
frontend-react/
  ├── src/main.jsx         → Bootstrap da SPA
  ├── src/App.jsx          → Rotas e layout principal
  ├── src/pages/           → Páginas (Home, Conta, Pagamento, Admin)
  └── src/lib/api.js       → Cliente HTTP com VITE_API_URL
```

### **Frontend legado (referência)**
```
legacy/
  ├── index.html
  ├── api-config.js
  ├── styles.css
  ├── css/
  └── js/
```

### **Backend (Node.js + Express)**
```
backend/
  ├── server.js          → API REST completa
  ├── database.sql       → Estrutura do banco
  ├── package.json       → Dependências
  └── .env              → Configurações (NÃO vai pro Git)
```

### **Banco de Dados (MySQL)**
```sql
Tabelas principais:
- usuarios          → Cadastro de clientes
- enderecos         → Endereços de entrega
- produtos          → Catálogo de produtos
- pedidos           → Pedidos realizados
- pedido_itens      → Itens de cada pedido
- cupons            → Cupons de desconto
- avaliacoes        → Avaliações de produtos
```

---

## 🎨 **Padrões de Código**

### **JavaScript**
- ✅ Frontend principal com React moderno (ES Modules)
- ✅ Backend Node.js com Express
- ✅ Código legado preservado em `legacy/`

### **Nomenclatura**
- ✅ Variáveis: `camelCase` (ex: `usuarioLogado`)
- ✅ Funções: `camelCase` (ex: `carregarProdutos()`)
- ✅ Constantes: `UPPER_CASE` (ex: `API_CONFIG`)
- ✅ Classes CSS: `kebab-case` (ex: `.cart-modal`)

### **Estrutura de Funções**
```javascript
// Padrão seguido no projeto
async function nomeDaFuncao() {
  try {
    var resultado = await API.get('/endpoint');
    if (resultado.erro) {
      alert('Erro: ' + resultado.erro);
      return;
    }
    // Processar resultado...
  } catch (erro) {
    console.error('Erro:', erro);
    alert('Mensagem amigável para o usuário');
  }
}
```

---

## 🔧 **Configuração**

### **Variáveis de Ambiente (.env)**
```env
# Banco de Dados
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=railway

# Autenticação
JWT_SECRET=chave_super_secreta

# Mercado Pago (PIX)
MP_ACCESS_TOKEN=seu_token
```

### **API Base URL**
```javascript
// frontend-react/src/lib/api.js
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
```

---

## 🚀 **Funcionalidades Implementadas**

- ✅ Sistema de login/cadastro com JWT
- ✅ Carrinho de compras com modal
- ✅ Catálogo de produtos com filtros
- ✅ Busca inteligente com autocomplete
- ✅ Sistema de cupons de desconto
- ✅ Histórico de compras
- ✅ Listas de compras personalizadas
- ✅ Rastreamento de pedidos
- ✅ Avaliações de produtos (1-5 estrelas)
\* Removidos do projeto: Favoritos e Programa de Pontos/Fidelidade
- ✅ Checkout com PIX (Mercado Pago)
- ✅ Painel administrativo
- ✅ Carrossel de promoções
- ✅ Produtos em oferta
- ✅ Gerenciamento de endereços

---

## 📝 **Decisões de Design**

### **Por que React + Vite no principal?**
- Deploy mais previsível
- Organização por componentes/páginas
- Build otimizada para produção

### **Por que módulos separados?**
- Organização e manutenibilidade
- Facilita debug
- Cada arquivo tem uma responsabilidade clara

### **Por que manter o legado?**
- Referência histórica do projeto
- Compatibilidade temporária enquanto a migração consolida

---

## 🐛 **Problemas Já Resolvidos**

1. ✅ Duplicação de código entre `script.js` e módulos
   - Solução: Removido script.js, mantido apenas módulos

2. ✅ Função `configurarSetores()` faltando
   - Solução: Adicionada em products.js

3. ✅ Ordem de carregamento de scripts
   - Solução: Reordenado por dependências

4. ✅ Conflito de variáveis globais
   - Solução: Cada módulo gerencia suas variáveis

---

## 🔄 **Fluxo de Trabalho**

### **Iniciar Projeto**
```bash
cd backend
npm install
npm run dev

cd ../frontend-react
npm install
npm run dev
```

### **Adicionar Nova Funcionalidade**
1. Criar endpoint no `backend/server.js` (se necessário)
2. Criar/atualizar módulo JS correspondente
3. Testar localmente
4. Commit e push

### **Estrutura de um Módulo JS**
```javascript
// ============================================
// MÓDULO DE [NOME]
// [Descrição breve]
// ============================================

var variavelGlobal = [];

function inicializarModulo() {
  // Setup inicial
}

async function funcaoAssincrona() {
  try {
    var resultado = await API.get('/endpoint');
    // Processar...
  } catch (erro) {
    console.error('Erro:', erro);
  }
}

// Expor funções globais se necessário
window.funcaoPublica = funcaoPublica;
```

---

## 💡 **Dicas para IA/Desenvolvedor**

### **Ao adicionar nova funcionalidade:**
1. Verificar se já existe módulo relacionado
2. Seguir o padrão de código existente
3. Adicionar comentários descritivos
4. Testar integração com backend
5. Atualizar documentação se necessário

### **Ao fazer debug:**
1. Verificar console do navegador (F12)
2. Verificar logs do backend (terminal)
3. Verificar se backend está rodando (porta 3000)
4. Verificar se MySQL está ativo

### **Ao refatorar:**
1. Manter compatibilidade ES5
2. Não quebrar funcionalidades existentes
3. Testar fluxo completo de compra
4. Verificar responsividade mobile

---

## 🎯 **Próximos Passos (Roadmap)**

### **Curto Prazo**
- [ ] Deploy em produção
- [ ] Testes completos de integração
- [ ] Otimização de performance
- [ ] Adicionar mais produtos ao catálogo

### **Médio Prazo**
- [ ] Sistema de notificações via WhatsApp
- [ ] Integração com entrega (correios/motoboy)
- [ ] Dashboard com métricas de vendas
- [ ] Sistema de promoções por categoria

### **Longo Prazo**
- [ ] App mobile (PWA)
- [ ] Sistema de assinaturas recorrentes
- [ ] Programa de afiliados
- [ ] Integração com ERPs

---

## 📞 **Comandos Úteis**

```bash
# Backend
npm run dev            # Iniciar backend (desenvolvimento)

# Frontend React
cd ../frontend-react
npm run dev            # Iniciar frontend em http://127.0.0.1:5173

# Git
git status             # Ver status
git add .              # Adicionar tudo
git commit -m "msg"    # Commitar
git push               # Enviar para GitHub
git pull               # Baixar do GitHub

# MySQL
mysql -u root -p       # Entrar no MySQL
source database.sql    # Executar script SQL
SHOW DATABASES;        # Listar bancos
USE railway;           # Selecionar banco
SHOW TABLES;           # Listar tabelas
```

---

## 🔗 **Links Importantes**

- GitHub: [Criar após setup]
- Documentação: README.md, GUIA_GITHUB.md
- Exemplos API: EXEMPLOS_API.md
- Testes: GUIA_TESTES.md

---

**Última Atualização:** 10/01/2026  
**Versão:** 1.0  
**Status:** Em Desenvolvimento (80% completo)
