-- 024: Adicionar campo unidade_venda aos produtos
-- Valores: 'unidade' (padrão) ou 'peso' (vendido por kg)

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS unidade_venda VARCHAR(20) DEFAULT 'unidade';

-- Migrar produtos que são vendidos por peso (detectar por nome/categoria)
UPDATE produtos SET unidade_venda = 'peso'
WHERE unidade_venda = 'unidade'
  AND (
    UPPER(nome) LIKE '%KG %'
    OR UPPER(nome) LIKE '% KG'
    OR UPPER(nome) LIKE '%AGRANEL%'
    OR UPPER(nome) LIKE '%GRANEL%'
    OR UPPER(nome) LIKE '%BALANCA%'
    OR LOWER(categoria) LIKE '%hortifruti%'
    OR LOWER(categoria) LIKE '%horti%'
  );
