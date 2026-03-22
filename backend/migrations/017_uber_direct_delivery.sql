-- ============================================
-- 017: Uber Direct - cotações, entregas, eventos e campos financeiros
-- ============================================

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'frete_cobrado_cliente');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN frete_cobrado_cliente DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER taxa_servico',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'frete_real_uber');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN frete_real_uber DECIMAL(10,2) NULL AFTER frete_cobrado_cliente',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'margem_pedido');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN margem_pedido DECIMAL(10,2) NULL AFTER frete_real_uber',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'uber_estimate_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN uber_estimate_id VARCHAR(64) NULL AFTER margem_pedido',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'uber_delivery_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN uber_delivery_id VARCHAR(64) NULL AFTER uber_estimate_id',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'uber_tracking_url');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN uber_tracking_url TEXT NULL AFTER uber_delivery_id',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'uber_vehicle_type');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN uber_vehicle_type VARCHAR(32) NULL AFTER uber_tracking_url',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'uber_eta_seconds');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN uber_eta_seconds INT NULL AFTER uber_vehicle_type',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'entrega_status');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN entrega_status VARCHAR(32) NULL AFTER uber_eta_seconds',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS uber_delivery_quotes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  estimate_id VARCHAR(64) NOT NULL,
  endereco_destino VARCHAR(255) NOT NULL,
  manifest_items JSON NOT NULL,
  total_weight_kg DECIMAL(10,3) NOT NULL,
  total_volume_points INT NOT NULL,
  valor_estimado DECIMAL(10,2) NOT NULL,
  eta_seconds INT NULL,
  raw_response JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_uber_quote_usuario_created (usuario_id, created_at),
  UNIQUE KEY uk_uber_estimate_id (estimate_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS uber_deliveries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  estimate_id VARCHAR(64) NOT NULL,
  uber_delivery_id VARCHAR(64) NOT NULL,
  tracking_url TEXT NULL,
  status VARCHAR(32) NOT NULL,
  eta_seconds INT NULL,
  vehicle_type VARCHAR(32) NULL,
  valor_real_uber DECIMAL(10,2) NULL,
  raw_response JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_uber_delivery_id (uber_delivery_id),
  UNIQUE KEY uk_uber_pedido_id (pedido_id),
  INDEX idx_uber_delivery_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS uber_delivery_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_external_id VARCHAR(128) NULL,
  pedido_id INT NULL,
  uber_delivery_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  payload JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_uber_event_external (event_external_id),
  INDEX idx_uber_event_delivery_created (uber_delivery_id, created_at),
  INDEX idx_uber_event_pedido_created (pedido_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
