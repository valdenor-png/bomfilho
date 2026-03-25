-- ============================================
-- 019: Taxonomia estruturada de categorias e subcategorias
-- ============================================

CREATE TABLE IF NOT EXISTS catalogo_categorias (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  ordem_exibicao INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  icone_url TEXT NULL,
  imagem_url TEXT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_categorias_ativo_ordem
  ON catalogo_categorias (ativo, ordem_exibicao, nome);

CREATE TABLE IF NOT EXISTS catalogo_subcategorias (
  id BIGSERIAL PRIMARY KEY,
  categoria_id BIGINT NOT NULL REFERENCES catalogo_categorias(id) ON DELETE CASCADE,
  nome VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL,
  ordem_exibicao INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  icone_url TEXT NULL,
  imagem_url TEXT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_catalogo_subcategorias_categoria_slug UNIQUE (categoria_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_subcategorias_categoria_ativo_ordem
  ON catalogo_subcategorias (categoria_id, ativo, ordem_exibicao, nome);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria_principal_id BIGINT NULL;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS subcategoria_id BIGINT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_produtos_categoria_principal'
  ) THEN
    ALTER TABLE produtos
      ADD CONSTRAINT fk_produtos_categoria_principal
      FOREIGN KEY (categoria_principal_id)
      REFERENCES catalogo_categorias(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_produtos_subcategoria'
  ) THEN
    ALTER TABLE produtos
      ADD CONSTRAINT fk_produtos_subcategoria
      FOREIGN KEY (subcategoria_id)
      REFERENCES catalogo_subcategorias(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_produtos_categoria_principal_id
  ON produtos (categoria_principal_id);

CREATE INDEX IF NOT EXISTS idx_produtos_subcategoria_id
  ON produtos (subcategoria_id);

CREATE INDEX IF NOT EXISTS idx_produtos_taxonomia_filtros
  ON produtos (ativo, categoria_principal_id, subcategoria_id);

-- Seed conservador das categorias principais com base no legado (departamento/categoria)
INSERT INTO catalogo_categorias (nome, slug, ordem_exibicao, ativo)
SELECT DISTINCT
  INITCAP(REPLACE(base_slug, '-', ' ')) AS nome,
  base_slug AS slug,
  999 AS ordem_exibicao,
  TRUE AS ativo
FROM (
  SELECT REGEXP_REPLACE(
           LOWER(TRIM(COALESCE(NULLIF(departamento, ''), NULLIF(categoria, ''), 'outros'))),
           '[^[:alnum:]]+',
           '-',
           'g'
         ) AS base_slug
  FROM produtos
  WHERE ativo = TRUE
) t
WHERE t.base_slug IS NOT NULL
  AND t.base_slug <> ''
ON CONFLICT (slug) DO NOTHING;

-- Vincula produtos existentes a categoria principal (somente quando ainda nao mapeado)
UPDATE produtos p
SET categoria_principal_id = c.id
FROM catalogo_categorias c
WHERE p.categoria_principal_id IS NULL
  AND c.slug = REGEXP_REPLACE(
    LOWER(TRIM(COALESCE(NULLIF(p.departamento, ''), NULLIF(p.categoria, ''), 'outros'))),
    '[^[:alnum:]]+',
    '-',
    'g'
  );

-- Seed conservador de subcategorias a partir de secao_exibicao para categorias ja mapeadas
INSERT INTO catalogo_subcategorias (categoria_id, nome, slug, ordem_exibicao, ativo)
SELECT DISTINCT
  p.categoria_principal_id AS categoria_id,
  INITCAP(REPLACE(sub_slug, '-', ' ')) AS nome,
  sub_slug AS slug,
  999 AS ordem_exibicao,
  TRUE AS ativo
FROM (
  SELECT
    id,
    categoria_principal_id,
    REGEXP_REPLACE(LOWER(TRIM(secao_exibicao)), '[^[:alnum:]]+', '-', 'g') AS sub_slug
  FROM produtos
  WHERE ativo = TRUE
    AND categoria_principal_id IS NOT NULL
    AND secao_exibicao IS NOT NULL
    AND TRIM(secao_exibicao) <> ''
) p
WHERE p.sub_slug IS NOT NULL
  AND p.sub_slug <> ''
ON CONFLICT (categoria_id, slug) DO NOTHING;

-- Vincula produtos existentes a subcategoria (somente quando ainda nao mapeado)
UPDATE produtos p
SET subcategoria_id = s.id
FROM catalogo_subcategorias s
WHERE p.subcategoria_id IS NULL
  AND p.categoria_principal_id IS NOT NULL
  AND s.categoria_id = p.categoria_principal_id
  AND s.slug = REGEXP_REPLACE(LOWER(TRIM(COALESCE(p.secao_exibicao, ''))), '[^[:alnum:]]+', '-', 'g');
