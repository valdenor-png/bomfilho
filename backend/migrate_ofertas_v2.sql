-- ===================================================================
-- MIGRAÇÃO: Sistema de Ofertas e Avaliações
-- ===================================================================
-- Este script adiciona os campos e tabelas necessários para:
-- 1. Produtos em Oferta com Desconto
-- 2. Sistema de Avaliações de Produtos
-- 3. (Removido) Programa de Pontos de Fidelidade
-- ===================================================================

-- Adicionar campos de desconto aos produtos (com verificação)
SET @query = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE produtos 
     ADD COLUMN desconto_percentual DECIMAL(5,2) DEFAULT 0,
     ADD COLUMN em_oferta BOOLEAN DEFAULT FALSE',
    'SELECT "Campos de desconto já existem" AS aviso'
  )
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'railway' 
    AND TABLE_NAME = 'produtos' 
    AND COLUMN_NAME = 'desconto_percentual'
);

PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Criar tabela de avaliações
CREATE TABLE IF NOT EXISTS avaliacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  produto_id INT NOT NULL,
  nota INT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  UNIQUE KEY idx_usuario_produto (usuario_id, produto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- (Removido) tabelas de pontos_fidelidade/historico_pontos

-- ===================================================================
-- DADOS INICIAIS: Produtos em Oferta
-- ===================================================================

-- Marcar produtos como ofertas (usando LIKE para encontrar produtos)
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 20.00 WHERE nome LIKE '%Banana%' LIMIT 1;
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 15.00 WHERE nome LIKE '%Café%' LIMIT 1;
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 10.00 WHERE nome LIKE '%Arroz%' LIMIT 1;
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 25.00 WHERE nome LIKE '%Detergente%' LIMIT 1;
UPDATE produtos SET em_oferta = TRUE, desconto_percentual = 30.00 WHERE nome LIKE '%Maçã%' LIMIT 1;

-- Verificar produtos em oferta
SELECT 
  id, 
  nome, 
  preco, 
  desconto_percentual,
  ROUND(preco * (1 - desconto_percentual/100), 2) AS preco_com_desconto,
  em_oferta
FROM produtos 
WHERE em_oferta = TRUE;

