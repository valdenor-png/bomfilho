-- ============================================
-- 015: Tabela webhook_events para idempotência persistente
--      + índices de performance em avaliacoes e pedido_itens
-- ============================================

-- Tabela de idempotência para webhooks PagBank (Q002)
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  idempotency_key VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_idempotency_key (idempotency_key),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice em avaliacoes para consultas por produto (Q051)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'avaliacoes' AND INDEX_NAME = 'idx_avaliacoes_produto_id');
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_avaliacoes_produto_id ON avaliacoes (produto_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice composto em pedido_itens pour consulta por pedido (Q051)
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedido_itens' AND INDEX_NAME = 'idx_pedido_itens_pedido_id');
SET @sql = IF(@idx_exists = 0,
  'CREATE INDEX idx_pedido_itens_pedido_id ON pedido_itens (pedido_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Limpeza automática de webhooks antigos (>30 dias) via evento scheduled
-- Nota: requer event_scheduler=ON no MySQL. Caso não esteja ativo, executar manualmente.
-- CREATE EVENT IF NOT EXISTS cleanup_webhook_events
--   ON SCHEDULE EVERY 1 DAY
--   DO DELETE FROM webhook_events WHERE created_at < NOW() - INTERVAL 30 DAY;
