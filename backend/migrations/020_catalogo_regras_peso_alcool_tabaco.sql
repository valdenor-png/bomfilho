-- ============================================
-- 020: Regras de catalogo (peso, 18+ e ocultacao de tabaco)
-- ============================================

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS unidade_venda VARCHAR(16) NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS peso_min_gramas INTEGER NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS peso_step_gramas INTEGER NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS peso_padrao_gramas INTEGER NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS permite_fracionado BOOLEAN NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS requer_maioridade BOOLEAN NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS visivel_no_site BOOLEAN NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS oculto_catalogo BOOLEAN NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS produto_controlado VARCHAR(32) NULL;

ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS unidade_venda VARCHAR(16) NULL;
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS peso_gramas INTEGER NULL;
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS preco_por_kg DECIMAL(10, 2) NULL;

UPDATE produtos
SET unidade_venda = 'peso'
WHERE unidade_venda IS NULL
  AND LOWER(COALESCE(unidade, '')) IN ('kg', 'quilo', 'kilo', 'g', 'gr', 'grama', 'gramas', 'granel', 'a granel');

UPDATE produtos
SET unidade_venda = 'unidade'
WHERE unidade_venda IS NULL OR TRIM(COALESCE(unidade_venda, '')) = '';

UPDATE produtos
SET visivel_no_site = TRUE
WHERE visivel_no_site IS NULL;

UPDATE produtos
SET oculto_catalogo = FALSE
WHERE oculto_catalogo IS NULL;

UPDATE produtos
SET permite_fracionado = TRUE
WHERE permite_fracionado IS NULL;

UPDATE produtos
SET requer_maioridade = FALSE
WHERE requer_maioridade IS NULL;

UPDATE produtos
SET peso_min_gramas = COALESCE(peso_min_gramas, 100),
    peso_step_gramas = COALESCE(peso_step_gramas, 50),
    peso_padrao_gramas = COALESCE(peso_padrao_gramas, 500)
WHERE unidade_venda = 'peso';

-- Regra especial: farinhas em incrementos de 500g
UPDATE produtos
SET peso_min_gramas = 500,
    peso_step_gramas = 500,
    peso_padrao_gramas = COALESCE(NULLIF(peso_padrao_gramas, 0), 500)
WHERE unidade_venda = 'peso'
  AND LOWER(COALESCE(nome, '')) LIKE '%farinha%';

-- Oculta tabaco/cigarro do catalogo publico sem remover do banco
UPDATE produtos
SET visivel_no_site = FALSE,
    oculto_catalogo = TRUE,
    produto_controlado = COALESCE(NULLIF(TRIM(produto_controlado), ''), 'tabaco')
WHERE LOWER(COALESCE(categoria, '')) LIKE '%tabaco%'
   OR LOWER(COALESCE(categoria, '')) LIKE '%cigar%'
   OR LOWER(COALESCE(nome, '')) LIKE '%tabaco%'
   OR LOWER(COALESCE(nome, '')) LIKE '%cigar%';
