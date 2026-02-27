-- ===================================================================
-- MIGRAÇÃO: Código de barras e imagem em produtos
-- ===================================================================

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'codigo_barras'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN codigo_barras VARCHAR(32) NULL AFTER marca',
  'SELECT "Coluna codigo_barras já existe"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'imagem_url'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN imagem_url TEXT NULL AFTER codigo_barras',
  'SELECT "Coluna imagem_url já existe"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND INDEX_NAME = 'idx_produtos_codigo_barras'
);
SET @sql := IF(
  @idx_exist = 0,
  'CREATE INDEX idx_produtos_codigo_barras ON produtos(codigo_barras)',
  'SELECT "Índice idx_produtos_codigo_barras já existe"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
