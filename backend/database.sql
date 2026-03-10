-- ============================================
-- BANCO DE DADOS - BOM FILHO SUPERMERCADO
-- ============================================

-- Remover banco existente e criar novo
DROP DATABASE IF EXISTS railway;
CREATE DATABASE railway CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE railway;

-- ============================================
-- TABELA DE USUÁRIOS
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    whatsapp_opt_in BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA DE ENDEREÇOS
-- ============================================
CREATE TABLE IF NOT EXISTS enderecos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    rua VARCHAR(255) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) NOT NULL,
    cep VARCHAR(10) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA DE PRODUTOS
-- ============================================
CREATE TABLE IF NOT EXISTS produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    marca VARCHAR(100),
    preco DECIMAL(10, 2) NOT NULL,
    unidade VARCHAR(10) DEFAULT '',
    categoria VARCHAR(50) NOT NULL,
    emoji VARCHAR(10) DEFAULT '🛒',
    estoque INT DEFAULT 100,
    validade DATE,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_categoria (categoria),
    INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA DE PEDIDOS
-- ============================================
CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente',
    forma_pagamento VARCHAR(20) DEFAULT 'pix',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TABELA DE ITENS DO PEDIDO
-- ============================================
CREATE TABLE IF NOT EXISTS pedido_itens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    produto_id INT NOT NULL,
    nome_produto VARCHAR(255) NOT NULL,
    preco DECIMAL(10, 2) NOT NULL,
    quantidade INT DEFAULT 1,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE RESTRICT,
    INDEX idx_pedido (pedido_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
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
-- TABELA DE USO DE CUPONS (controlar quem usou)
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
-- INSERIR PRODUTOS INICIAIS
-- ============================================
INSERT INTO produtos (nome, descricao, marca, preco, unidade, categoria, emoji, estoque, validade) VALUES
-- Hortifruti
('Banana', 'Banana prata fresca, rica em potássio e fibras. Ideal para lanches e vitaminas.', 'Hortifruti Natural', 4.99, 'kg', 'hortifruti', '🍌', 80, DATE_ADD(CURDATE(), INTERVAL 7 DAY)),
('Tomate', 'Tomate salada vermelho maduro, perfeito para saladas e molhos caseiros.', 'Hortifruti Natural', 5.49, 'kg', 'hortifruti', '🍅', 60, DATE_ADD(CURDATE(), INTERVAL 10 DAY)),
('Cenoura', 'Cenoura orgânica crocante, rica em vitamina A e antioxidantes.', 'Hortifruti Orgânico', 3.29, 'kg', 'hortifruti', '🥕', 50, DATE_ADD(CURDATE(), INTERVAL 14 DAY)),
('Alface', 'Alface crespa fresquinha, colhida do dia. Ótima para saladas.', 'Hortifruti Natural', 2.50, 'un', 'hortifruti', '🥬', 45, DATE_ADD(CURDATE(), INTERVAL 5 DAY)),
('Maçã', 'Maçã gala premium, doce e crocante. Importada de qualidade.', 'Premium Fruits', 6.99, 'kg', 'hortifruti', '🍎', 70, DATE_ADD(CURDATE(), INTERVAL 20 DAY)),

-- Bebidas
('Leite UHT', 'Leite integral UHT 1L, fonte de cálcio e proteínas. Longa vida.', 'Italac', 3.50, 'un', 'bebidas', '🥛', 120, DATE_ADD(CURDATE(), INTERVAL 90 DAY)),
('Café 500g', 'Café torrado e moído tradicional, aroma intenso e sabor marcante.', 'Pilão', 15.90, 'un', 'bebidas', '☕', 55, DATE_ADD(CURDATE(), INTERVAL 180 DAY)),

-- Mercearia
('Pão Francês (6)', 'Pão francês tradicional, quentinho e crocante. Pacote com 6 unidades.', 'Padaria Bom Filho', 2.80, 'pct', 'mercearia', '🥖', 200, CURDATE()),
('Arroz 5kg', 'Arroz branco tipo 1, grãos soltos e de qualidade superior.', 'Tio João', 19.90, 'un', 'mercearia', '🍚', 150, DATE_ADD(CURDATE(), INTERVAL 365 DAY)),
('Feijão 1kg', 'Feijão carioca tipo 1, grãos selecionados. Cozimento rápido.', 'Camil', 7.50, 'un', 'mercearia', '🫘', 95, DATE_ADD(CURDATE(), INTERVAL 365 DAY)),
('Óleo de Soja 900ml', 'Óleo de soja refinado, ideal para cozinhar e fritar.', 'Liza', 8.90, 'un', 'mercearia', '🧈', 110, DATE_ADD(CURDATE(), INTERVAL 270 DAY)),
('Açúcar 1kg', 'Açúcar cristal branco refinado, adoça sem alterar o sabor.', 'União', 4.20, 'un', 'mercearia', '🍬', 180, DATE_ADD(CURDATE(), INTERVAL 540 DAY)),
('Macarrão 500g', 'Macarrão parafuso sêmola, ao dente perfeito. Rende muito.', 'Galo', 3.99, 'un', 'mercearia', '🍝', 140, DATE_ADD(CURDATE(), INTERVAL 450 DAY)),

-- Açougue
('Frango Congelado 1kg', 'Frango inteiro congelado IQF, criado sem hormônios.', 'Sadia', 12.90, 'kg', 'acougue', '🍗', 75, DATE_ADD(CURDATE(), INTERVAL 180 DAY)),
('Carne Bovina 1kg', 'Carne bovina de primeira, macia e suculenta. Corte nobre.', 'Friboi', 29.90, 'kg', 'acougue', '🥩', 40, DATE_ADD(CURDATE(), INTERVAL 30 DAY)),

-- Limpeza
('Detergente 500ml', 'Detergente líquido concentrado, remove gordura facilmente. Neutro.', 'Ypê', 2.99, 'un', 'limpeza', '🧼', 160, DATE_ADD(CURDATE(), INTERVAL 730 DAY)),
('Sabão em Pó 1kg', 'Sabão em pó multiação, remove manchas difíceis. Rende 15 lavagens.', 'Omo', 12.90, 'un', 'limpeza', '🧴', 85, DATE_ADD(CURDATE(), INTERVAL 900 DAY));

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View de usuários com endereços
CREATE OR REPLACE VIEW vw_usuarios_completos AS
SELECT 
    u.id,
    u.nome,
    u.email,
    u.telefone,
    u.whatsapp_opt_in,
    u.criado_em,
    e.rua,
    e.numero,
    e.bairro,
    e.cidade,
    e.estado,
    e.cep
FROM usuarios u
LEFT JOIN enderecos e ON u.id = e.usuario_id;

-- View de pedidos completos
CREATE OR REPLACE VIEW vw_pedidos_completos AS
SELECT 
    p.id as pedido_id,
    p.usuario_id,
    u.nome as usuario_nome,
    u.email as usuario_email,
    p.total,
    p.status,
    p.criado_em,
    COUNT(pi.id) as quantidade_itens
FROM pedidos p
JOIN usuarios u ON p.usuario_id = u.id
LEFT JOIN pedido_itens pi ON p.id = pi.pedido_id
GROUP BY p.id, p.usuario_id, u.nome, u.email, p.total, p.status, p.criado_em;

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
-- MENSAGEM DE SUCESSO
-- ============================================
SELECT 'Banco de dados criado com sucesso!' as Mensagem;
SELECT COUNT(*) as Total_Produtos FROM produtos;
SELECT COUNT(*) as Total_Cupons FROM cupons;

