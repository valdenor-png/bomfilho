-- =============================================================
-- Migration 016: Mercado Pago + Etapa de Revisão
-- =============================================================
-- Adiciona colunas para integração com Mercado Pago e
-- suporte à etapa de revisão do pedido antes do pagamento.
-- Idempotente: usa IF NOT EXISTS via INFORMATION_SCHEMA.
-- =============================================================

SET @db := DATABASE();

-- ─── mp_payment_id_mp: ID do pagamento no Mercado Pago ───────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN mp_payment_id_mp VARCHAR(64) NULL AFTER mp_payment_id',
    'SELECT "SKIP: mp_payment_id_mp já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'mp_payment_id_mp'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── gateway_pagamento: qual gateway foi usado (pagbank ou mercadopago) ───
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN gateway_pagamento VARCHAR(20) NULL DEFAULT NULL AFTER forma_pagamento',
    'SELECT "SKIP: gateway_pagamento já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'gateway_pagamento'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── revisao_em: timestamp de quando o pedido entrou em revisão ──
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN revisao_em DATETIME NULL DEFAULT NULL AFTER criado_em',
    'SELECT "SKIP: revisao_em já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'revisao_em'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── revisao_aprovada_em: timestamp de aprovação da revisão ──────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN revisao_aprovada_em DATETIME NULL DEFAULT NULL AFTER revisao_em',
    'SELECT "SKIP: revisao_aprovada_em já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'revisao_aprovada_em'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── revisao_obs: observação do operador na revisão ──────────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD COLUMN revisao_obs TEXT NULL AFTER revisao_aprovada_em',
    'SELECT "SKIP: revisao_obs já existe"'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'revisao_obs'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── Índice para fila de revisão ─────────────────────────────────
SET @sql := (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE pedidos ADD INDEX idx_pedidos_aguardando_revisao (status, revisao_em)',
    'SELECT "SKIP: idx_pedidos_aguardando_revisao já existe"'
  )
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pedidos' AND INDEX_NAME = 'idx_pedidos_aguardando_revisao'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
