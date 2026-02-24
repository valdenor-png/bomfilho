-- ===================================================================
-- MIGRAÇÃO: Ofertas e Avaliações
-- ===================================================================
-- Adiciona funcionalidades finais: ofertas e avaliações
-- ===================================================================

-- 1. ADICIONAR CAMPOS DE OFERTA NOS PRODUTOS
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS desconto_percentual DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS em_oferta BOOLEAN DEFAULT FALSE;

-- 2. CRIAR TABELA DE AVALIAÇÕES
CREATE TABLE IF NOT EXISTS avaliacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  usuario_id INT NOT NULL,
  nota INT NOT NULL CHECK (nota >= 1 AND nota <= 5),
  comentario TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  UNIQUE KEY unica_avaliacao (produto_id, usuario_id)
);

-- 3. ADICIONAR ALGUNS PRODUTOS EM OFERTA
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 20 WHERE nome LIKE '%Banana%';
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 15 WHERE nome LIKE '%Café%';
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 10 WHERE nome LIKE '%Arroz%';
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 25 WHERE nome LIKE '%Detergente%';
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 30 WHERE nome LIKE '%Maçã%';

-- ===================================================================
-- FIM DA MIGRAÇÃO
-- ===================================================================
SELECT 'Migração concluída! Ofertas e Avaliações criados.' AS Status;
