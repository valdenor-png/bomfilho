# 🧪 GUIA RÁPIDO DE TESTES

## 🚀 SETUP INICIAL

### 1. Iniciar o Servidor Backend
```bash
cd backend
node server.js
```
✅ Você deve ver: "🚀 Servidor rodando na porta 3000"

### 2. Abrir o Site
Abra o arquivo `index.html` no navegador ou acesse via Live Server

---

## 🧪 ROTEIRO DE TESTES COMPLETO

### TESTE 1: Criar Conta e Login
1. Clique no botão **👤 Entrar** no header
2. Clique em **"Criar Conta"**
3. Preencha:
   - Nome: "João Silva"
   - Email: "joao@teste.com"
   - Senha: "123456"
4. Clique em **"Cadastrar"**
5. Faça login com as mesmas credenciais

✅ **Resultado esperado:** Você verá "👤 João Silva" no header

---

### TESTE 2: Busca Inteligente 🔍
1. Clique no campo de busca
2. Digite: "arr"
3. Aguarde sugestões aparecerem
4. Use as setas ↑ ↓ para navegar
5. Pressione Enter para selecionar

✅ **Resultado esperado:** Sugestões aparecem e produto é destacado

---

### TESTE 3: Ver Ofertas 🏷️
1. Role a página até o topo
2. Veja a seção **"🏷️ Ofertas Especiais"**
3. Observe os badges de desconto (-20%, -10%, -25%)
4. Note os preços riscados vs preços promocionais

✅ **Resultado esperado:** 3 produtos em oferta com desconto visível

---

### TESTE 4: Favoritar Produtos ❤️
1. Encontre um produto
2. Clique no coração 🤍
3. Veja o coração ficar vermelho ❤️
4. Observe o contador no header aumentar
5. Clique no botão **❤️** no header para ver a lista

✅ **Resultado esperado:** Modal com produtos favoritados

---

### TESTE 5: Criar Lista de Compras 📝
1. Clique no botão **📝** no header
2. Clique em **"Criar Nova Lista"**
3. Digite: "Compras de Sábado"
4. Escolha um emoji (ex: 🛒)
5. Clique em **"Criar"**
6. Adicione produtos clicando no botão **+** nos cards
7. Ajuste quantidades com **+** e **-**

✅ **Resultado esperado:** Lista criada com produtos e total calculado

---

### TESTE 6: Adicionar ao Carrinho 🛒
1. Clique em **"Adicionar"** em alguns produtos
2. Observe o contador do carrinho aumentar
3. Clique no botão **🛒** no header

✅ **Resultado esperado:** Modal do carrinho com produtos adicionados

---

### TESTE 7: Calcular Frete 📦
1. Com produtos no carrinho, veja a seção de frete
2. Digite um CEP: **01310-100**
3. Clique em **"Calcular"**
4. Aguarde 1 segundo (simulação de API)

✅ **Resultado esperado:** 
```
PAC
Valor: R$ 15,00
Prazo: 3 dias úteis
```

---

### TESTE 8: Aplicar Cupom 🎟️
1. No carrinho, clique em **"Finalizar Compra"**
2. Clique em **"Ver cupons disponíveis"**
3. Copie o código **BEMVINDO10**
4. Cole no campo de cupom
5. Clique em **"Aplicar"**

✅ **Resultado esperado:** "✅ Cupom aplicado! Desconto de 10% (R$ X,XX)"

---

### TESTE 9: Finalizar Pedido 💳
1. Selecione forma de pagamento (PIX ou Dinheiro)
2. Clique em **"Confirmar Pedido"**

✅ **Resultado esperado:** 
- Pedido criado com sucesso
- Pontos adicionados automaticamente
- Código PIX gerado (se escolheu PIX)

---

### TESTE 10: Ver Histórico 📋
1. Clique no botão **📋** no header
2. Veja a lista de pedidos
3. Clique em **"🔍 Rastrear"** em um pedido

✅ **Resultado esperado:** Timeline visual com status do pedido

---

### TESTE 11: Rastreamento de Pedido 🚚
1. No modal de rastreamento, observe:
   - 📦 Pedido Recebido (verde)
   - 👨‍🍳 Em Preparação (amarelo)
   - 🚚 Saiu para Entrega (azul)
   - ✅ Entregue (verde)
2. Veja o código de rastreamento

✅ **Resultado esperado:** Timeline animada com barra de progresso

---

### TESTE 12: Avaliar Produto ⭐
1. Clique em **"⭐ Avaliar"** em qualquer produto
2. Selecione 5 estrelas
3. Digite um comentário: "Produto excelente! Recomendo."
4. Clique em **"Publicar Avaliação"**
5. Veja sua avaliação aparecer na lista

✅ **Resultado esperado:** Avaliação salva e exibida com seu nome

---

### TESTE 13: Comprar Novamente 🔄
1. No histórico de pedidos
2. Clique em **"🔄 Comprar Novamente"**
3. Confirme a ação

✅ **Resultado esperado:** Produtos adicionados ao carrinho

---

### TESTE 14: Ver Cupons Disponíveis 🎟️
1. Clique no botão **🎟️** no header
2. Veja os 5 cupons disponíveis:
   - PRIMEIRACOMPRA (R$ 10,00)
   - BEMVINDO10 (10%)
   - FRETE10 (R$ 10,00)
   - NATAL25 (25%)
   - DESCONTO15 (15%)

✅ **Resultado esperado:** Modal com lista de cupons e códigos

---

## 🎯 CENÁRIO COMPLETO (Fluxo do Usuário)

### Cenário: "Compra de Fim de Semana"

1. **Login**: João entra no sistema
2. **Busca**: Pesquisa por "arroz" usando busca inteligente
3. **Ofertas**: Vê que arroz está com 10% de desconto
4. **Lista**: Cria lista "Churrasco do Domingo" 🥩
5. **Adiciona**: Coloca arroz, carne, refrigerante
6. **Carrinho**: Adiciona lista toda ao carrinho
7. **Frete**: Calcula frete para seu CEP
8. **Cupom**: Aplica cupom NATAL25 para 25% de desconto
9. **Finaliza**: Paga via PIX
10. **Rastreamento**: Acompanha status do pedido
11. **Avaliação**: Após receber, avalia produtos com 5 ⭐

✅ **Tempo estimado:** 5-7 minutos

---

## 📊 CHECKLIST DE VERIFICAÇÃO

Marque cada item após testar:

- [ ] 📋 Ver histórico de pedidos
- [ ] 🎟️ Aplicar cupom de desconto
- [ ] 🚚 Rastrear pedido com timeline
- [ ] 🔍 Buscar produto com autocomplete
- [ ] 📝 Criar lista de compras
- [ ] 🏷️ Ver produtos em oferta
- [ ] ⭐ Avaliar produto com estrelas
- [ ] 📦 Calcular frete por CEP

---

## 🐛 PROBLEMAS COMUNS E SOLUÇÕES

### Problema: "Erro ao conectar com servidor"
**Solução:** Certifique-se que o servidor backend está rodando na porta 3000

### Problema: "Usuário não autenticado"
**Solução:** Faça login primeiro antes de acessar funcionalidades restritas

### Problema: "Cupom inválido"
**Solução:** Use um dos cupons válidos: BEMVINDO10, NATAL25, etc.

---

## 🎉 CONCLUSÃO

Se todos os testes passaram, o sistema está **100% funcional**! 

**Parabéns!** Você tem um e-commerce completo com:
- ✅ Funcionalidades principais ativas
- ✅ Avaliações de produtos
- ✅ Cálculo de frete
- ✅ Cupons de desconto
- ✅ E muito mais!

---

**Data do teste:** _____________
**Testado por:** _____________
**Status:** [ ] Aprovado [ ] Reprovado
