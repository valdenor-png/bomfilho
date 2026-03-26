-- ============================================
-- 021: Blindagem de integridade de catalogo (taxonomia + estoque + revisao)
-- ============================================

CREATE TABLE IF NOT EXISTS produto_estoque_movimentos (
  id BIGSERIAL PRIMARY KEY,
  produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  tipo_movimento VARCHAR(32) NOT NULL,
  quantidade INTEGER NOT NULL,
  estoque_anterior INTEGER NOT NULL,
  estoque_posterior INTEGER NOT NULL,
  origem VARCHAR(64) NOT NULL DEFAULT 'sistema',
  referencia VARCHAR(120) NULL,
  observacao TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(80) NULL
);

CREATE INDEX IF NOT EXISTS idx_produto_estoque_movimentos_produto_data
  ON produto_estoque_movimentos (produto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_produto_estoque_movimentos_tipo_data
  ON produto_estoque_movimentos (tipo_movimento, created_at DESC);

CREATE TABLE IF NOT EXISTS produto_taxonomia_auditoria (
  id BIGSERIAL PRIMARY KEY,
  produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  categoria_id_anterior BIGINT NULL REFERENCES catalogo_categorias(id) ON DELETE SET NULL,
  subcategoria_id_anterior BIGINT NULL REFERENCES catalogo_subcategorias(id) ON DELETE SET NULL,
  categoria_id_nova BIGINT NULL REFERENCES catalogo_categorias(id) ON DELETE SET NULL,
  subcategoria_id_nova BIGINT NULL REFERENCES catalogo_subcategorias(id) ON DELETE SET NULL,
  motivo VARCHAR(80) NOT NULL DEFAULT 'ajuste_taxonomia',
  confianca NUMERIC(5, 4) NULL,
  origem VARCHAR(64) NOT NULL DEFAULT 'sistema',
  payload_resumo JSONB NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(80) NULL
);

CREATE INDEX IF NOT EXISTS idx_produto_taxonomia_auditoria_produto_data
  ON produto_taxonomia_auditoria (produto_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_produto_taxonomia_auditoria_origem_data
  ON produto_taxonomia_auditoria (origem, created_at DESC);

CREATE TABLE IF NOT EXISTS produto_revisao_pendente (
  id BIGSERIAL PRIMARY KEY,
  produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  motivo VARCHAR(80) NOT NULL,
  categoria_sugerida_id BIGINT NULL REFERENCES catalogo_categorias(id) ON DELETE SET NULL,
  subcategoria_sugerida_id BIGINT NULL REFERENCES catalogo_subcategorias(id) ON DELETE SET NULL,
  score NUMERIC(5, 4) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberto',
  detalhes JSONB NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP NULL,
  resolved_by VARCHAR(80) NULL,
  CONSTRAINT chk_produto_revisao_status
    CHECK (status IN ('aberto', 'aprovado', 'rejeitado', 'corrigido'))
);

CREATE INDEX IF NOT EXISTS idx_produto_revisao_status_data
  ON produto_revisao_pendente (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_produto_revisao_produto_status
  ON produto_revisao_pendente (produto_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_produto_revisao_aberto_produto_motivo
  ON produto_revisao_pendente (produto_id, motivo)
  WHERE status = 'aberto';

CREATE OR REPLACE FUNCTION fn_produtos_validar_integridade_taxonomia()
RETURNS TRIGGER AS $$
DECLARE
  v_categoria_sub BIGINT;
BEGIN
  IF NEW.estoque IS NOT NULL AND NEW.estoque < 0 THEN
    RAISE EXCEPTION 'Estoque negativo nao permitido para produto id=%', COALESCE(NEW.id, 0)
      USING ERRCODE = '23514';
  END IF;

  IF NEW.subcategoria_id IS NOT NULL AND NEW.categoria_principal_id IS NULL THEN
    RAISE EXCEPTION 'Produto id=% com subcategoria sem categoria_principal_id', COALESCE(NEW.id, 0)
      USING ERRCODE = '23514';
  END IF;

  IF NEW.subcategoria_id IS NOT NULL AND NEW.categoria_principal_id IS NOT NULL THEN
    SELECT s.categoria_id
      INTO v_categoria_sub
      FROM catalogo_subcategorias s
     WHERE s.id = NEW.subcategoria_id;

    IF v_categoria_sub IS NULL THEN
      RAISE EXCEPTION 'Subcategoria id=% inexistente', NEW.subcategoria_id
        USING ERRCODE = '23503';
    END IF;

    IF v_categoria_sub <> NEW.categoria_principal_id THEN
      RAISE EXCEPTION 'Subcategoria id=% nao pertence a categoria_principal_id=% (produto id=%)',
        NEW.subcategoria_id,
        NEW.categoria_principal_id,
        COALESCE(NEW.id, 0)
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_produtos_validar_integridade_taxonomia ON produtos;

CREATE TRIGGER trg_produtos_validar_integridade_taxonomia
BEFORE INSERT OR UPDATE OF categoria_principal_id, subcategoria_id, estoque
ON produtos
FOR EACH ROW
EXECUTE FUNCTION fn_produtos_validar_integridade_taxonomia();

CREATE OR REPLACE FUNCTION fn_produtos_auditar_taxonomia()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       OLD.categoria_principal_id IS DISTINCT FROM NEW.categoria_principal_id
       OR OLD.subcategoria_id IS DISTINCT FROM NEW.subcategoria_id
     ) THEN
    INSERT INTO produto_taxonomia_auditoria (
      produto_id,
      categoria_id_anterior,
      subcategoria_id_anterior,
      categoria_id_nova,
      subcategoria_id_nova,
      motivo,
      origem,
      payload_resumo
    )
    VALUES (
      NEW.id,
      OLD.categoria_principal_id,
      OLD.subcategoria_id,
      NEW.categoria_principal_id,
      NEW.subcategoria_id,
      'ajuste_taxonomia',
      'trigger_produtos',
      jsonb_build_object(
        'categoria_legado', COALESCE(NEW.categoria, ''),
        'departamento_legado', COALESCE(NEW.departamento, '')
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_produtos_auditar_taxonomia ON produtos;

CREATE TRIGGER trg_produtos_auditar_taxonomia
AFTER UPDATE OF categoria_principal_id, subcategoria_id
ON produtos
FOR EACH ROW
EXECUTE FUNCTION fn_produtos_auditar_taxonomia();

CREATE OR REPLACE FUNCTION fn_produtos_registrar_movimento_estoque()
RETURNS TRIGGER AS $$
DECLARE
  v_delta INTEGER;
  v_tipo VARCHAR(32);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estoque IS DISTINCT FROM OLD.estoque THEN
    v_delta := COALESCE(NEW.estoque, 0) - COALESCE(OLD.estoque, 0);

    IF v_delta > 0 THEN
      v_tipo := 'entrada';
    ELSIF v_delta < 0 THEN
      v_tipo := 'saida';
    ELSE
      v_tipo := 'ajuste';
    END IF;

    INSERT INTO produto_estoque_movimentos (
      produto_id,
      tipo_movimento,
      quantidade,
      estoque_anterior,
      estoque_posterior,
      origem,
      referencia,
      observacao
    )
    VALUES (
      NEW.id,
      v_tipo,
      ABS(v_delta),
      COALESCE(OLD.estoque, 0),
      COALESCE(NEW.estoque, 0),
      'trigger_produtos',
      'estoque_update',
      'Movimento registrado automaticamente por trigger de integridade.'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_produtos_registrar_movimento_estoque ON produtos;

CREATE TRIGGER trg_produtos_registrar_movimento_estoque
AFTER UPDATE OF estoque
ON produtos
FOR EACH ROW
EXECUTE FUNCTION fn_produtos_registrar_movimento_estoque();

CREATE OR REPLACE FUNCTION fn_produtos_sinalizar_revisao_taxonomia()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(NEW.ativo, TRUE) = TRUE AND NEW.categoria_principal_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM produto_revisao_pendente r
       WHERE r.produto_id = NEW.id
         AND r.motivo = 'sem_categoria_principal'
         AND r.status = 'aberto'
    ) THEN
      INSERT INTO produto_revisao_pendente (
        produto_id,
        motivo,
        status,
        detalhes
      )
      VALUES (
        NEW.id,
        'sem_categoria_principal',
        'aberto',
        jsonb_build_object(
          'categoria_legado', COALESCE(NEW.categoria, ''),
          'departamento_legado', COALESCE(NEW.departamento, '')
        )
      );
    END IF;
  END IF;

  IF NEW.categoria_principal_id IS NOT NULL THEN
    UPDATE produto_revisao_pendente
       SET status = 'corrigido',
           resolved_at = NOW(),
           resolved_by = 'trigger_produtos'
     WHERE produto_id = NEW.id
       AND motivo = 'sem_categoria_principal'
       AND status = 'aberto';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_produtos_sinalizar_revisao_taxonomia ON produtos;

CREATE TRIGGER trg_produtos_sinalizar_revisao_taxonomia
AFTER INSERT OR UPDATE OF categoria_principal_id, ativo
ON produtos
FOR EACH ROW
EXECUTE FUNCTION fn_produtos_sinalizar_revisao_taxonomia();

INSERT INTO produto_revisao_pendente (
  produto_id,
  motivo,
  status,
  detalhes
)
SELECT
  p.id,
  'sem_categoria_principal',
  'aberto',
  jsonb_build_object(
    'categoria_legado', COALESCE(p.categoria, ''),
    'departamento_legado', COALESCE(p.departamento, '')
  )
FROM produtos p
WHERE p.ativo = TRUE
  AND p.categoria_principal_id IS NULL
  AND NOT EXISTS (
    SELECT 1
      FROM produto_revisao_pendente r
     WHERE r.produto_id = p.id
       AND r.motivo = 'sem_categoria_principal'
       AND r.status = 'aberto'
  );
