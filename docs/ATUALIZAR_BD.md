# 🔄 Atualização do Banco de Dados

## Como atualizar o banco para incluir a forma de pagamento

### Opção 1: Via Laragon Terminal (Recomendado) 🚀

1. Abra o **Laragon**
2. Clique com botão direito no ícone do Laragon na bandeja
3. Vá em **MySQL** → **mysql**
4. Um terminal MySQL será aberto
5. Cole estes comandos:

```sql
USE bom_filho_db;

ALTER TABLE pedidos 
ADD COLUMN forma_pagamento VARCHAR(20) DEFAULT 'pix' AFTER status;

UPDATE pedidos SET forma_pagamento = 'pix' WHERE forma_pagamento IS NULL;
```

6. Pressione **Enter** após cada comando

### Opção 2: Via PowerShell/CMD

1. Abra o **PowerShell** ou **CMD**
2. Navegue até a pasta do projeto:
```powershell
cd "c:\Users\sekom\OneDrive\Documentos\site"
```

3. Execute o script de migração:
```powershell
mysql -u root -p bom_filho_db < backend\migrate_pagamento.sql
```

4. Se pedir senha, pressione **Enter** (Laragon não tem senha padrão)

### Opção 3: Via HeidiSQL (se estiver usando)

1. Abra o **HeidiSQL** pelo Laragon (clique com botão direito → Database)
2. Conecte ao banco `bom_filho_db`
3. Clique na aba **Query**
4. Cole o código SQL:

```sql
ALTER TABLE pedidos 
ADD COLUMN forma_pagamento VARCHAR(20) DEFAULT 'pix' AFTER status;

UPDATE pedidos SET forma_pagamento = 'pix' WHERE forma_pagamento IS NULL;
```

5. Clique em **Executar** (F9)

### Opção 4: Recriar o banco (se estiver testando)

Se você não tem pedidos importantes, pode recriar o banco completo:

1. Abra o terminal MySQL do Laragon (botão direito → MySQL → mysql)
2. Cole o conteúdo do arquivo `backend/database.sql` completo
3. Ou execute via PowerShell:
```powershell
mysql -u root < backend\database.sql
```

---

## ✅ Melhorias Implementadas

### 1. **Métodos de Pagamento** 💳
- **PIX** - Pagamento instantâneo com código PIX gerado
- **Pagar na Entrega** - Dinheiro ou cartão na entrega

### 2. **Modal de Checkout Melhorado** 🛒
- Interface moderna com seleção visual de pagamento
- Resumo completo do pedido antes de confirmar
- Informações específicas por método de pagamento
- Botões de voltar e confirmar

### 3. **Admin Atualizado** 👨‍💼
- Pedidos agora mostram a forma de pagamento escolhida
- Ícone 💳 indica o método: PIX ou Na Entrega
- Atualização automática a cada 30 segundos

### 4. **Backend Atualizado** 🔧
- Salva forma de pagamento no banco
- Gera código PIX simulado para pagamentos PIX
- Retorna informações completas ao frontend

---

## 🧪 Como Testar

1. **Execute a migração** (escolha uma opção acima)
2. **Reinicie o servidor** Node.js (se estiver rodando)
3. **Faça um pedido** no site:
   - Adicione produtos ao carrinho
   - Clique em "Finalizar Pedido"
   - Escolha um método de pagamento
   - Confirme o pedido
4. **Verifique no Admin**:
   - Abra `admin.html`
   - O pedido deve aparecer com o método de pagamento

---

## 📋 Estrutura da Coluna

```sql
forma_pagamento VARCHAR(20) DEFAULT 'pix'
```

**Valores aceitos:**
- `pix` - Pagamento via PIX
- `entrega` - Pagamento na entrega

---

## 🐛 Solução de Problemas

### Erro: Column 'forma_pagamento' doesn't exist
➡️ Execute a migração SQL acima

### Pedidos não aparecem no admin
➡️ Verifique se o servidor Node.js está rodando

### Código PIX não aparece
➡️ É um código simulado, apenas para demonstração

---

## 🎉 Pronto!

Agora seu sistema tem:
- ✅ Métodos de pagamento funcionando
- ✅ Interface moderna de checkout
- ✅ Admin mostrando forma de pagamento
- ✅ Código PIX gerado automaticamente
