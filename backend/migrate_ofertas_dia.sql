-- Migração: Ofertas do Dia
-- Tabela para gerenciar quais produtos aparecem na vitrine "Ofertas do Dia"
-- Atualizada manualmente via admin semanalmente

CREATE TABLE IF NOT EXISTS ofertas_dia (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  ordem INT DEFAULT 0,
  ativo TINYINT(1) DEFAULT 1,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_produto (produto_id),
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_ofertas_dia_ativo_ordem ON ofertas_dia(ativo, ordem);
