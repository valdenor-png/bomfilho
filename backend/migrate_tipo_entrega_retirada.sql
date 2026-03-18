-- Migracao para adicionar tipo_entrega aos pedidos
-- Compativel com MySQL 5.7 (sem ADD COLUMN IF NOT EXISTS)
USE railway;

SET @db := DATABASE();

SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN tipo_entrega ENUM(''entrega'', ''retirada'') DEFAULT ''entrega'' AFTER forma_pagamento',
    'SELECT "SKIP: tipo_entrega ja existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'tipo_entrega'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Normaliza registros antigos para manter compatibilidade.
UPDATE pedidos
SET tipo_entrega = 'entrega'
WHERE tipo_entrega IS NULL
  OR TRIM(tipo_entrega) = ''
  OR tipo_entrega NOT IN ('entrega', 'retirada');
