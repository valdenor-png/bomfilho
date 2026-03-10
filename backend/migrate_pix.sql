-- Adiciona colunas para pagamentos via PIX (compatível com MySQL)
-- Observação: MySQL NÃO suporta `ADD COLUMN IF NOT EXISTS`.
-- Este script é idempotente: roda mais de uma vez sem quebrar.

USE railway;

SET @db := DATABASE();

-- mp_payment_id
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN mp_payment_id VARCHAR(64) NULL AFTER forma_pagamento',
    'SELECT "SKIP: mp_payment_id já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'mp_payment_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pix_status
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN pix_status VARCHAR(32) NULL AFTER mp_payment_id',
    'SELECT "SKIP: pix_status já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'pix_status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pix_qr_data
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN pix_qr_data TEXT NULL AFTER pix_status',
    'SELECT "SKIP: pix_qr_data já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'pix_qr_data'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pix_qr_base64
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN pix_qr_base64 LONGTEXT NULL AFTER pix_qr_data',
    'SELECT "SKIP: pix_qr_base64 já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'pix_qr_base64'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pix_id (PagBank order id)
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN pix_id VARCHAR(64) NULL AFTER pix_qr_base64',
    'SELECT "SKIP: pix_id já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'pix_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pix_codigo (copia e cola)
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN pix_codigo TEXT NULL AFTER pix_id',
    'SELECT "SKIP: pix_codigo já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'pix_codigo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- pix_qrcode (URL do QR Code)
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN pix_qrcode TEXT NULL AFTER pix_codigo',
    'SELECT "SKIP: pix_qrcode já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'pix_qrcode'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

