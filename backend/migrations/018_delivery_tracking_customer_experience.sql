-- ============================================
-- 018: Customer delivery tracking + safety fields
-- ============================================

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_provider');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_provider VARCHAR(24) NULL AFTER tipo_entrega',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_mode');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_mode VARCHAR(24) NULL AFTER delivery_provider',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_status_internal');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_status_internal VARCHAR(48) NULL AFTER delivery_mode',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_status_provider');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_status_provider VARCHAR(96) NULL AFTER delivery_status_internal',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_eta_min');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_eta_min INT NULL AFTER delivery_status_provider',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_eta_max');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_eta_max INT NULL AFTER delivery_eta_min',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_tracking_url');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_tracking_url TEXT NULL AFTER delivery_eta_max',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_pin');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_pin VARCHAR(32) NULL AFTER delivery_tracking_url',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_pin_revealed_at');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_pin_revealed_at DATETIME NULL AFTER delivery_pin',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_proof_photo_url');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_proof_photo_url TEXT NULL AFTER delivery_pin_revealed_at',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_proof_signature_url');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_proof_signature_url TEXT NULL AFTER delivery_proof_photo_url',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'courier_name');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN courier_name VARCHAR(120) NULL AFTER delivery_proof_signature_url',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'courier_phone_masked');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN courier_phone_masked VARCHAR(32) NULL AFTER courier_name',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'courier_vehicle');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN courier_vehicle VARCHAR(64) NULL AFTER courier_phone_masked',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'courier_lat');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN courier_lat DECIMAL(10,7) NULL AFTER courier_vehicle',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'courier_lng');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN courier_lng DECIMAL(10,7) NULL AFTER courier_lat',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'last_delivery_event_at');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN last_delivery_event_at DATETIME NULL AFTER courier_lng',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_help_state');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_help_state VARCHAR(64) NULL AFTER last_delivery_event_at',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_issue_flag');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_issue_flag TINYINT(1) NOT NULL DEFAULT 0 AFTER delivery_help_state',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_recipient_name');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_recipient_name VARCHAR(120) NULL AFTER delivery_issue_flag',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'delivery_recipient_note');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN delivery_recipient_note VARCHAR(255) NULL AFTER delivery_recipient_name',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS delivery_tracking_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pedido_id INT NOT NULL,
  source VARCHAR(24) NOT NULL,
  provider_event_id VARCHAR(128) NULL,
  event_name VARCHAR(64) NOT NULL,
  status_internal VARCHAR(48) NULL,
  status_provider VARCHAR(96) NULL,
  title VARCHAR(160) NULL,
  description VARCHAR(255) NULL,
  occurred_at DATETIME NOT NULL,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_delivery_tracking_provider_event (provider_event_id),
  INDEX idx_delivery_tracking_pedido_occurred (pedido_id, occurred_at),
  INDEX idx_delivery_tracking_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
