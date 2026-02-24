# 🔧 GUIA DE SOLUÇÃO RÁPIDA

## ✅ STATUS ATUAL

✅ **Servidor Backend:** RODANDO (porta 3000)  
✅ **Banco de Dados:** CONECTADO (17 produtos)  
✅ **Arquivos:** TODOS NO LUGAR

---

## 🚀 COMO ABRIR O SITE CORRETAMENTE

### PASSO 1: Verifique o Servidor
Certifique-se que você vê esta mensagem no terminal:
```
🚀 Servidor rodando na porta 3000
✅ Conectado ao MySQL com sucesso!
```

Se NÃO vê isso, execute:
```bash
cd C:\Users\sekom\OneDrive\Documentos\site\backend
node server.js
```

### PASSO 2: Abra o Site
Abra o arquivo `index.html` no navegador:

**Opção 1 - Duplo clique:**
- Navegue até: `C:\Users\sekom\OneDrive\Documentos\site\`
- Dê duplo clique em `index.html`

**Opção 2 - Via PowerShell:**
```powershell
Start-Process "C:\Users\sekom\OneDrive\Documentos\site\index.html"
```

### PASSO 3: Abra o Console do Navegador
- Pressione **F12** no navegador
- Clique na aba **Console**
- Procure por erros (texto em vermelho)

---

## 🐛 PROBLEMAS COMUNS

### ❌ Problema 1: "Failed to fetch" ou "ERR_CONNECTION_REFUSED"
**Causa:** O servidor backend não está rodando  
**Solução:**
```bash
cd C:\Users\sekom\OneDrive\Documentos\site\backend
node server.js
```

### ❌ Problema 2: Produtos não aparecem, mas sem erro
**Causa:** JavaScript pode estar desabilitado ou arquivo não carrega  
**Solução:**
1. Pressione F12 → Console
2. Digite: `produtos`
3. Se retornar `undefined`, recarregue a página (Ctrl+F5)

### ❌ Problema 3: "CORS error"
**Causa:** Navegador bloqueando requisições locais  
**Solução:**
1. Use Chrome/Edge (melhor suporte)
2. Ou instale extensão "Allow CORS"
3. Ou use Live Server do VS Code

### ❌ Problema 4: Página abre mas está "quebrada"
**Causa:** CSS não carregou  
**Solução:**
1. Verifique se `styles.css` existe
2. Recarregue com Ctrl+F5 (limpa cache)

---

## 🧪 TESTAR SE ESTÁ FUNCIONANDO

### Teste 1: API está respondendo?
Abra no navegador: http://localhost:3000

Deve ver:
```json
{
  "mensagem": "🛒 API Bom Filho Supermercado",
  "versao": "1.0.0",
  "status": "online"
}
```

### Teste 2: Produtos estão sendo retornados?
Abra no navegador: http://localhost:3000/api/produtos

Deve ver uma lista de 17 produtos em JSON.

### Teste 3: Página de teste
Abra o arquivo: `teste-conexao.html`

Esta página faz testes automáticos e mostra se tudo está OK.

---

## 🔍 DIAGNÓSTICO DETALHADO

### Verificar se o servidor está rodando:
```powershell
# Ver processos Node.js ativos
Get-Process node -ErrorAction SilentlyContinue

# Testar a porta 3000
Test-NetConnection -ComputerName localhost -Port 3000
```

### Verificar produtos no banco:
```bash
cd backend
echo "SELECT COUNT(*) FROM produtos;" | mysql -u root bom_filho_db
```

### Logs do servidor:
Veja o terminal onde o servidor está rodando. Cada requisição deve aparecer lá.

---

## ✨ SOLUÇÃO DEFINITIVA

Se NADA funcionar, faça um reset completo:

```powershell
# 1. Pare todos os processos Node
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# 2. Navegue até a pasta do projeto
cd "C:\Users\sekom\OneDrive\Documentos\site\backend"

# 3. Inicie o servidor
node server.js

# 4. Abra NOVA aba/janela do navegador (não recarregue)
# 5. Abra o index.html
```

**Aguarde 2 segundos entre parar e iniciar o servidor!**

---

## 📝 CHECKLIST DE VERIFICAÇÃO

Marque cada item:

- [ ] Servidor está rodando (vejo a mensagem no terminal)
- [ ] MySQL/Laragon está ligado
- [ ] Abri o `index.html` (não outro arquivo)
- [ ] Vejo a página com header "Bom Filho"
- [ ] Pressione F12 → Console está sem erros vermelhos
- [ ] Aguardei pelo menos 2 segundos após carregar a página
- [ ] Testei http://localhost:3000 no navegador

---

## 🎯 SE TUDO ESTIVER OK MAS NÃO VER PRODUTOS

Execute este teste no Console do navegador (F12):

```javascript
// Cole isso no console e pressione Enter:
fetch('http://localhost:3000/api/produtos')
  .then(r => r.json())
  .then(data => {
    console.log('✅ Total de produtos:', data.produtos.length);
    console.log('📦 Primeiros 3:', data.produtos.slice(0, 3));
  })
  .catch(err => console.error('❌ Erro:', err));
```

Se ver os produtos no console mas não na página, o problema é no JavaScript do frontend.

---

## 🆘 ÚLTIMA TENTATIVA

Se REALMENTE nada funcionar:

1. Feche TODOS os navegadores
2. Pare o servidor Node (Ctrl+C no terminal)
3. Reinicie o Laragon
4. Aguarde 10 segundos
5. Inicie o servidor novamente
6. Abra o navegador em modo anônimo (Ctrl+Shift+N)
7. Abra o index.html

---

## 📞 INFORMAÇÕES PARA DEBUG

**Versão do Node:** `node --version`  
**Porta do servidor:** 3000  
**URL da API:** http://localhost:3000/api  
**Banco de dados:** bom_filho_db  
**Total de produtos:** 17  
**Arquivos JS:** 12 módulos

---

**Criado em:** 9 de janeiro de 2026  
**Última atualização:** Agora  
