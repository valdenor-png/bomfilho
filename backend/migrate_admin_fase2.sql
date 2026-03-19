-- ============================================
-- MIGRAÇÃO FASE 2 — Admin Profissional
-- Auditoria + índices de performance
-- ============================================

-- Tabela de auditoria administrativa
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  acao VARCHAR(80) NOT NULL,
  entidade VARCHAR(40) NULL,
  entidade_id INT NULL,
  detalhes JSON NULL,
  admin_usuario VARCHAR(80) NOT NULL DEFAULT 'admin',
  ip VARCHAR(45) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_acao (acao),
  INDEX idx_entidade (entidade, entidade_id),
  INDEX idx_criado (criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices adicionais para performance de consultas agregadas
ALTER TABLE pedidos ADD INDEX idx_criado_status (criado_em, status);
ALTER TABLE pedidos ADD INDEX idx_usuario_criado (usuario_id, criado_em);
ALTER TABLE pedido_itens ADD INDEX idx_produto_pedido (produto_id, pedido_id);
