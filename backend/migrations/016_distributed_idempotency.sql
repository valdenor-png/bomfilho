-- ============================================
-- 016: Idempotência distribuída para pedidos/pagamentos
-- ============================================

CREATE TABLE IF NOT EXISTS idempotency_operations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  pedido_id BIGINT UNSIGNED NULL,
  request_fingerprint CHAR(64) NOT NULL,
  status ENUM('processing', 'completed', 'failed') NOT NULL DEFAULT 'processing',
  http_status SMALLINT NULL,
  response_payload_json MEDIUMTEXT NULL,
  last_error VARCHAR(255) NULL,
  lock_until DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_idempotency_scope_key_user (scope, idempotency_key, user_id),
  KEY idx_idempotency_scope_pedido_user (scope, pedido_id, user_id),
  KEY idx_idempotency_status_lock (status, lock_until),
  KEY idx_idempotency_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
