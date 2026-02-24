-- ============================================
-- MIGRAÇÃO: Adicionar Sistema de Cupons
-- Execute este script no HeidiSQL ou MySQL para atualizar o banco
-- ============================================

USE bom_filho_db;

-- TABELA DE CUPONS
-- ============================================
CREATE TABLE IF NOT EXISTS cupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    descricao VARCHAR(255),
    tipo ENUM('percentual', 'valor_fixo') DEFAULT 'percentual',
    valor DECIMAL(10, 2) NOT NULL,
    valor_minimo DECIMAL(10, 2) DEFAULT 0,
    validade DATE,
    ativo BOOLEAN DEFAULT TRUE,
    uso_maximo INT DEFAULT NULL,
    uso_atual INT DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_codigo (codigo),
    INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA DE USO DE CUPONS
-- ============================================
CREATE TABLE IF NOT EXISTS cupons_usados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cupom_id INT NOT NULL,
    usuario_id INT NOT NULL,
    pedido_id INT NOT NULL,
    usado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cupom_id) REFERENCES cupons(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERIR CUPONS DE EXEMPLO
-- ============================================
INSERT INTO cupons (codigo, descricao, tipo, valor, valor_minimo, validade, ativo) VALUES
('BEMVINDO10', 'Cupom de boas-vindas - 10% de desconto', 'percentual', 10.00, 30.00, '2026-12-31', TRUE),
('PRIMEIRACOMPRA', 'Primeira compra - R$ 15 OFF', 'valor_fixo', 15.00, 50.00, '2026-12-31', TRUE),
('NATAL2026', 'Promoção de Natal - 20% OFF', 'percentual', 20.00, 100.00, '2026-12-25', TRUE),
('FRETE10', 'Desconto de R$ 10 no pedido', 'valor_fixo', 10.00, 40.00, '2026-06-30', TRUE),
('MEGA50', 'Mega desconto 50% OFF', 'percentual', 50.00, 200.00, '2026-03-31', TRUE);

-- ============================================
-- VERIFICAÇÃO
-- ============================================
SELECT 'Tabelas criadas com sucesso!' as Mensagem;
SELECT COUNT(*) as Total_Cupons FROM cupons;
