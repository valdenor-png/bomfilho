-- ===================================================================
-- MIGRACAO: Importacao de produtos por planilha (ERP)
-- ===================================================================
-- Adiciona colunas de apoio na tabela produtos e cria historico
-- de importacoes em importacoes_produtos.
-- ===================================================================

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'codigo_interno'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN codigo_interno VARCHAR(64) NULL',
  'SELECT "Coluna codigo_interno ja existe"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'preco_promocional'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN preco_promocional DECIMAL(10,2) NULL',
  'SELECT "Coluna preco_promocional ja existe"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'ultima_importacao_em'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN ultima_importacao_em DATETIME NULL',
  'SELECT "Coluna ultima_importacao_em ja existe"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND COLUMN_NAME = 'ultima_atualizacao_preco_em'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE produtos ADD COLUMN ultima_atualizacao_preco_em DATETIME NULL',
  'SELECT "Coluna ultima_atualizacao_preco_em ja existe"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND INDEX_NAME = 'idx_produtos_codigo_interno'
);
SET @sql := IF(
  @idx_exist = 0,
  'CREATE INDEX idx_produtos_codigo_interno ON produtos(codigo_interno)',
  'SELECT "Indice idx_produtos_codigo_interno ja existe"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exist := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'produtos'
    AND INDEX_NAME = 'idx_produtos_ultima_importacao'
);
SET @sql := IF(
  @idx_exist = 0,
  'CREATE INDEX idx_produtos_ultima_importacao ON produtos(ultima_importacao_em)',
  'SELECT "Indice idx_produtos_ultima_importacao ja existe"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS importacoes_produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_arquivo VARCHAR(255) NOT NULL,
  total_linhas INT NOT NULL DEFAULT 0,
  total_atualizados INT NOT NULL DEFAULT 0,
  total_criados INT NOT NULL DEFAULT 0,
  total_ignorados INT NOT NULL DEFAULT 0,
  total_erros INT NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'concluido',
  resumo_json LONGTEXT NULL,
  usuario_id INT NULL,
  usuario_nome VARCHAR(120) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_importacoes_produtos_criado_em (criado_em),
  INDEX idx_importacoes_produtos_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
