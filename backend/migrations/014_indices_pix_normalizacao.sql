-- ============================================
-- MIGRAÇÃO 014 — Índices e normalização PIX
-- Performance + saneamento de colunas PIX
-- ============================================

-- Índice em pedido_itens(produto_id) para queries de relatórios
-- (complementa idx_produto_pedido de 012_admin_fase2 se não existir)
SET @idx_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedido_itens'
    AND INDEX_NAME = 'idx_produto_id'
);
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE pedido_itens ADD INDEX idx_produto_id (produto_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índice composto em cupons_usados para validação de uso por usuário
SET @idx_exists2 = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cupons_usados'
    AND INDEX_NAME = 'idx_cupom_usuario'
);
SET @sql2 = IF(@idx_exists2 = 0,
  'ALTER TABLE cupons_usados ADD INDEX idx_cupom_usuario (cupom_id, usuario_id)',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Documentação: colunas PIX na tabela pedidos
-- pix_qr_data   → payload completo do QR (copia-e-cola / EMV)
-- pix_qrcode    → URL da imagem QR code gerada pelo PagBank
-- pix_qr_base64 → base64 da imagem QR (legado, não mais populado)
-- pix_codigo    → alias do pix_qr_data (legado, não mais populado)
-- Manter todas por retrocompatibilidade; novas escritas usam pix_qr_data e pix_qrcode apenas.
