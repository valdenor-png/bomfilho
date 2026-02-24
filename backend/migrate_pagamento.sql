-- Migração para adicionar forma de pagamento aos pedidos
USE bom_filho_db;

-- Adicionar coluna forma_pagamento na tabela pedidos (se não existir)
ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(20) DEFAULT 'pix' AFTER status;

-- Atualizar pedidos existentes para ter forma de pagamento padrão
UPDATE pedidos SET forma_pagamento = 'pix' WHERE forma_pagamento IS NULL;
