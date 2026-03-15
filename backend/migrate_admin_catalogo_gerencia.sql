-- ===================================================================
-- MIGRACAO: Catalogo administrativo (gerencia)
-- ===================================================================
-- Estrutura para dashboard, filtros avancados, enriquecimento por barcode
-- e logs de importacao/enriquecimento.
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
  'ALTER TABLE produtos ADD COLUMN codigo_barras VARCHAR(32) NULL',
  'SELECT 1'
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
  'ALTER TABLE produtos ADD COLUMN imagem_url TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'preco_tabela'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN preco_tabela DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'enrichment_status'
);
SET @sql := IF(
  @exist = 0,
  "ALTER TABLE produtos ADD COLUMN enrichment_status VARCHAR(30) NOT NULL DEFAULT 'pendente'",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'enrichment_provider'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN enrichment_provider VARCHAR(80) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'enrichment_last_attempt_at'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN enrichment_last_attempt_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'enrichment_updated_at'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN enrichment_updated_at DATETIME NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'enrichment_last_error'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN enrichment_last_error VARCHAR(255) NULL',
  'SELECT 1'
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
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND INDEX_NAME = 'idx_produtos_preco_tabela'
);
SET @sql := IF(
  @idx_exist = 0,
  'CREATE INDEX idx_produtos_preco_tabela ON produtos(preco_tabela)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND INDEX_NAME = 'idx_produtos_enrichment_status'
);
SET @sql := IF(
  @idx_exist = 0,
  'CREATE INDEX idx_produtos_enrichment_status ON produtos(enrichment_status)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND INDEX_NAME = 'idx_produtos_nome_admin'
);
SET @sql := IF(
  @idx_exist = 0,
  'CREATE INDEX idx_produtos_nome_admin ON produtos(nome)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS product_import_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  arquivo_nome VARCHAR(255) NOT NULL,
  total_linhas INT NOT NULL DEFAULT 0,
  linhas_validas INT NOT NULL DEFAULT 0,
  linhas_com_erro INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'concluido',
  resumo LONGTEXT NULL,
  criado_por VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_import_logs_created_at (created_at),
  INDEX idx_product_import_logs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_enrichment_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NULL,
  barcode VARCHAR(32) NOT NULL,
  provider VARCHAR(80) NULL,
  status VARCHAR(40) NOT NULL,
  mensagem VARCHAR(255) NULL,
  payload_resumido LONGTEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_enrichment_logs_produto (produto_id),
  INDEX idx_product_enrichment_logs_barcode (barcode),
  INDEX idx_product_enrichment_logs_status (status),
  INDEX idx_product_enrichment_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS barcode_lookup_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  barcode VARCHAR(32) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'not_found',
  provider VARCHAR(80) NULL,
  payload_json LONGTEXT NULL,
  error_message VARCHAR(255) NULL,
  looked_up_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_barcode_lookup_cache_barcode (barcode),
  INDEX idx_barcode_lookup_cache_status (status),
  INDEX idx_barcode_lookup_cache_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
