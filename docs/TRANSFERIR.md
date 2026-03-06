# 🚀 GUIA RÁPIDO: Transferir Projeto

## ⚡ Método Mais Rápido (5 minutos)

### **Passo 1: Preparar no Computador Atual**
```bash
# Executar script automático
.\setup-git.ps1
```
**OU** manualmente:
```bash
git init
git add .
git commit -m "Projeto inicial"
```

### **Passo 2: Criar no GitHub**
1. Acesse: https://github.com/new
2. Nome: `bom-filho-supermercado`
3. Private ✅
4. Create repository

### **Passo 3: Enviar Código**
```bash
# Copie os comandos que o GitHub mostrar, algo como:
git remote add origin https://github.com/SEU_USUARIO/bom-filho-supermercado.git
git push -u origin main
```

### **Passo 4: Baixar no Outro Computador**
```bash
git clone https://github.com/SEU_USUARIO/bom-filho-supermercado.git
cd bom-filho-supermercado
cd backend
npm install
cd ..
cd frontend-react
npm install
```

### **Passo 5: Configurar**
1. Criar `backend\.env` (copiar de `.env.example`)
2. Configurar banco de dados MySQL
3. Executar `backend\database.sql`
4. Iniciar backend: `npm run dev` (dentro de `backend`)
5. Iniciar frontend React: `npm run dev` (dentro de `frontend-react`)

---

## 📊 Comparação de Métodos

| Método | Tempo | Complexidade | Custo |
|--------|-------|--------------|-------|
| **Git + GitHub** | 10 min | Fácil | Grátis |
| **Arquivo ZIP** | 5 min | Muito Fácil | Grátis |
| **Google Drive** | 5 min | Muito Fácil | Grátis |
| **OneDrive** | 5 min | Muito Fácil | Grátis |

---

## 🎯 Escolha Seu Método

### ✅ Use Git/GitHub se:
- Vai trabalhar em vários computadores
- Quer histórico de mudanças
- Quer fazer deploy automático
- Quer colaborar com outros

### ✅ Use ZIP se:
- É transferência única
- Não sabe Git
- Quer algo rápido e simples

---

## 🆘 Problemas e Soluções

### "Git não é reconhecido"
```bash
# Instalar Git
https://git-scm.com/download/win
# Reiniciar terminal após instalar
```

### "npm não é reconhecido"
```bash
# Instalar Node.js
https://nodejs.org/
# Reiniciar terminal após instalar
```

### "Acesso negado ao GitHub"
- Use **Personal Access Token** em vez de senha
- Crie em: GitHub → Settings → Developer settings → Tokens

---

## 📁 Estrutura que será transferida

```
bom-filho-supermercado/
├── frontend-react/         ✅ Frontend principal (React + Vite)
├── legacy/                 ✅ Frontend antigo (HTML/CSS/JS)
├── backend/
│   ├── server.js          ✅ Servidor Node.js
│   ├── package.json       ✅ Dependências
│   ├── database.sql       ✅ Estrutura do banco
│   └── .env.example       ✅ Exemplo de config
└── img/                   ✅ Imagens (se houver)
```

### ❌ O que NÃO será transferido (por segurança):
- `node_modules/` (muito pesado, instale com npm)
- `.env` (contém senhas)
- Logs e arquivos temporários

---

## 🔄 Para Atualizações Futuras

### Enviar mudanças:
```bash
git add .
git commit -m "descrição da mudança"
git push
```

### Receber mudanças:
```bash
git pull
```

---

## ✅ Checklist Final

Antes de transferir:
- [ ] Testou o projeto localmente
- [ ] `.env.example` está atualizado
- [ ] Documentação está clara

Após transferir:
- [ ] Instalou Node.js
- [ ] Instalou MySQL
- [ ] Executou `npm install` em `backend` e `frontend-react`
- [ ] Criou arquivo `.env`
- [ ] Executou `database.sql`
- [ ] Testou backend em `http://localhost:3000/api`
- [ ] Testou frontend em `http://127.0.0.1:5173`

---

💡 **Dica:** Para mais detalhes, veja `GUIA_GITHUB.md`
