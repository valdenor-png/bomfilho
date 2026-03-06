# 📦 Como Transferir o Projeto via GitHub

## 🎯 Opção 1: Usando Git e GitHub (RECOMENDADO)

### **No Computador Atual (Origem)**

#### 1️⃣ Inicializar Git
```bash
cd "c:\Users\sekom\OneDrive\Documentos\site"
git init
git add .
git commit -m "Projeto inicial - Bom Filho Supermercado"
```

#### 2️⃣ Criar Repositório no GitHub
1. Acesse [github.com](https://github.com)
2. Clique em **"New Repository"** ou **"+"** > **"New repository"**
3. Preencha:
   - **Nome:** `bom-filho-supermercado`
   - **Descrição:** `Sistema de e-commerce para supermercado`
   - **Visibilidade:** `Private` (recomendado) ou `Public`
   - **NÃO** marque "Initialize with README" (já temos arquivos)
4. Clique em **"Create repository"**

#### 3️⃣ Conectar e Enviar
```bash
# Substitua SEU_USUARIO pelo seu usuário do GitHub
git remote add origin https://github.com/SEU_USUARIO/bom-filho-supermercado.git
git branch -M main
git push -u origin main
```

Se pedir login, use:
- **Username:** seu usuário do GitHub
- **Password:** um **Personal Access Token** (não a senha comum)
  - Crie em: Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
  - Selecione: `repo` (full control)

### **No Computador Novo (Destino)**

#### 4️⃣ Clonar o Repositório
```bash
# Escolha uma pasta para o projeto
cd C:\projetos

# Clone o repositório
git clone https://github.com/SEU_USUARIO/bom-filho-supermercado.git
cd bom-filho-supermercado
```

#### 5️⃣ Instalar Dependências
```bash
# Instalar dependências do backend
cd backend
npm install
cd ..

# Instalar dependências do frontend React
cd frontend-react
npm install
cd ..
```

#### 6️⃣ Configurar Ambiente
```bash
# Criar arquivo .env no backend
cd backend
copy .env.example .env
notepad .env
```

Edite o `.env` com suas credenciais:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=bom_filho_db
JWT_SECRET=gere_uma_chave_aleatoria_segura
MP_ACCESS_TOKEN=seu_token_mercadopago
```

#### 7️⃣ Configurar Banco de Dados
```bash
# No MySQL Workbench ou linha de comando
mysql -u root -p < backend/database.sql
```

#### 8️⃣ Iniciar o Projeto
```bash
# Iniciar backend
cd backend
npm run dev

# Em outro terminal, iniciar frontend React
cd frontend-react
npm run dev
```

Acesse:
- Frontend: `http://127.0.0.1:5173`
- API: `http://localhost:3000/api`

> O frontend HTML antigo foi movido para `legacy/`.

---

## 🎯 Opção 2: Sem Git (Arquivo ZIP)

### **No Computador Atual**

#### 1️⃣ Compactar Arquivos
```bash
# Criar um ZIP manualmente:
# - Selecione a pasta "site"
# - Clique com botão direito → "Enviar para" → "Pasta compactada"
# - Nomeie: bom-filho-projeto.zip
```

#### 2️⃣ Transferir
- **Google Drive:** Upload do ZIP
- **OneDrive:** Upload do ZIP
- **Email:** Envie para si mesmo
- **Pen Drive:** Copie o arquivo
- **WeTransfer:** Envie gratuitamente (até 2GB)

### **No Computador Novo**

#### 1️⃣ Extrair
- Baixe o arquivo ZIP
- Clique com botão direito → "Extrair tudo"
- Escolha uma pasta (ex: `C:\projetos`)

#### 2️⃣ Seguir passos 5-8 da Opção 1

---

## 🎯 Opção 3: Git com Repositório Privado Gratuito

### Alternativas ao GitHub:
- **GitLab:** Repositórios privados ilimitados
- **Bitbucket:** Repositórios privados grátis
- **Azure DevOps:** Repositórios privados grátis

Processo é idêntico à Opção 1, apenas mude a URL do remote.

---

## ⚠️ IMPORTANTE: Arquivos que NUNCA devem ir pro Git

Estes arquivos já estão no `.gitignore`:
- ❌ `node_modules/` (muito pesado, instale com npm install)
- ❌ `.env` (contém senhas e chaves secretas)
- ❌ `*.log` (arquivos de log temporários)

---

## 🔄 Atualizações Futuras

### Enviar mudanças (Computador Atual)
```bash
git add .
git commit -m "Descrição das mudanças"
git push
```

### Receber mudanças (Computador Novo)
```bash
git pull
```

---

## 📋 Checklist de Transferência

### ✅ Antes de transferir:
- [ ] Testou o projeto localmente
- [ ] Verificou se `.gitignore` está correto
- [ ] Criou `.env.example` com exemplo de configurações
- [ ] Documentou dependências no README

### ✅ Após transferir:
- [ ] Clonou/extraiu os arquivos
- [ ] Instalou Node.js (se não tiver)
- [ ] Instalou MySQL (se não tiver)
- [ ] Executou `npm install` no `backend`
- [ ] Executou `npm install` no `frontend-react`
- [ ] Criou arquivo `.env` com suas credenciais
- [ ] Executou `database.sql` no MySQL
- [ ] Testou iniciar backend (`npm run dev`)
- [ ] Testou abrir frontend (`http://127.0.0.1:5173`)

---

## 🆘 Problemas Comuns

### "git: command not found"
**Solução:** Instalar Git
- Windows: [git-scm.com](https://git-scm.com/download/win)
- Após instalar, reiniciar o terminal

### "npm: command not found"
**Solução:** Instalar Node.js
- [nodejs.org](https://nodejs.org/) (versão LTS)

### "Error: connect ECONNREFUSED"
**Solução:** MySQL não está rodando
- Iniciar MySQL Workbench ou XAMPP
- Verificar se o serviço MySQL está ativo

### "Access denied for user"
**Solução:** Credenciais erradas no `.env`
- Verificar usuário e senha do MySQL
- Atualizar arquivo `.env`

---

## 💡 Dica Extra: Deploy Automático

Depois de enviar pro GitHub, você pode conectar:
- **Vercel** → Deploy automático do frontend
- **Railway** → Deploy automático do backend
- **PlanetScale** → Banco de dados MySQL em nuvem

Toda vez que fizer `git push`, atualiza automaticamente!

---

## 📞 Comandos Úteis

```bash
# Ver status dos arquivos
git status

# Ver histórico de commits
git log --oneline

# Ver arquivos ignorados
git status --ignored

# Desfazer mudanças não commitadas
git checkout .

# Criar nova branch
git checkout -b nova-funcionalidade

# Voltar para branch principal
git checkout main

# Ver diferenças
git diff
```
