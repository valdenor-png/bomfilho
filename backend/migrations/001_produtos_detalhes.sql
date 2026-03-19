-- ===================================================================
-- MIGRAÇÃO: Adicionar Descrições Detalhadas aos Produtos
-- ===================================================================
-- Este script adiciona as colunas descricao, marca, estoque e validade
-- à tabela produtos e atualiza com os dados individuais de cada produto
-- ===================================================================

-- 1. Adicionar novas colunas à tabela produtos (verifica se já existem)
-- Ignorar erros se as colunas já existirem
SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = 'railway' 
               AND TABLE_NAME = 'produtos' 
               AND COLUMN_NAME = 'descricao');
SET @sql := IF(@exist = 0, 'ALTER TABLE produtos ADD COLUMN descricao TEXT AFTER nome', 'SELECT "Coluna descricao já existe"');
PREPARE stmt FROM @sql;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = 'railway' 
               AND TABLE_NAME = 'produtos' 
               AND COLUMN_NAME = 'marca');
SET @sql := IF(@exist = 0, 'ALTER TABLE produtos ADD COLUMN marca VARCHAR(100) AFTER descricao', 'SELECT "Coluna marca já existe"');
PREPARE stmt FROM @sql;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = 'railway' 
               AND TABLE_NAME = 'produtos' 
               AND COLUMN_NAME = 'estoque');
SET @sql := IF(@exist = 0, 'ALTER TABLE produtos ADD COLUMN estoque INT DEFAULT 100 AFTER categoria', 'SELECT "Coluna estoque já existe"');
PREPARE stmt FROM @sql;
EXECUTE stmt;

SET @exist := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = 'railway' 
               AND TABLE_NAME = 'produtos' 
               AND COLUMN_NAME = 'validade');
SET @sql := IF(@exist = 0, 'ALTER TABLE produtos ADD COLUMN validade DATE AFTER estoque', 'SELECT "Coluna validade já existe"');
PREPARE stmt FROM @sql;
EXECUTE stmt;

-- 2. Atualizar cada produto com sua descrição, marca, estoque e validade individuais

-- HORTIFRUTI
UPDATE produtos SET 
  descricao = 'Banana prata fresca, rica em potássio e fibras. Ideal para lanches e vitaminas.',
  marca = 'Hortifruti Natural',
  estoque = 80,
  validade = DATE_ADD(CURDATE(), INTERVAL 7 DAY)
WHERE nome = 'Banana';

UPDATE produtos SET 
  descricao = 'Maçã vermelha crocante e suculenta. Fonte de vitaminas e antioxidantes.',
  marca = 'Hortifruti Natural',
  estoque = 65,
  validade = DATE_ADD(CURDATE(), INTERVAL 15 DAY)
WHERE nome = 'Maçã';

UPDATE produtos SET 
  descricao = 'Tomate fresco e maduro, perfeito para saladas e molhos caseiros.',
  marca = 'Hortifruti Natural',
  estoque = 90,
  validade = DATE_ADD(CURDATE(), INTERVAL 10 DAY)
WHERE nome = 'Tomate';

UPDATE produtos SET 
  descricao = 'Alface crespa fresquinha, cultivada sem agrotóxicos. Rica em fibras.',
  marca = 'Hortifruti Natural',
  estoque = 40,
  validade = DATE_ADD(CURDATE(), INTERVAL 5 DAY)
WHERE nome = 'Alface';

UPDATE produtos SET 
  descricao = 'Batata de primeira qualidade, ideal para cozidos, assados e frituras.',
  marca = 'Hortifruti Natural',
  estoque = 150,
  validade = DATE_ADD(CURDATE(), INTERVAL 30 DAY)
WHERE nome = 'Batata';

-- BEBIDAS
UPDATE produtos SET 
  descricao = 'Leite integral UHT 1 litro, fonte de cálcio e proteínas. Pasteurizado e seguro.',
  marca = 'Italac',
  estoque = 120,
  validade = DATE_ADD(CURDATE(), INTERVAL 90 DAY)
WHERE nome = 'Leite UHT';

UPDATE produtos SET 
  descricao = 'Café torrado e moído tradicional, 100% arábica. Sabor encorpado e aroma intenso.',
  marca = 'Pilão',
  estoque = 55,
  validade = DATE_ADD(CURDATE(), INTERVAL 180 DAY)
WHERE nome = 'Café';

-- MERCEARIA
UPDATE produtos SET 
  descricao = 'Arroz branco tipo 1, grãos selecionados e soltinhos. Rende muito e não empapa.',
  marca = 'Tio João',
  estoque = 200,
  validade = DATE_ADD(CURDATE(), INTERVAL 365 DAY)
WHERE nome = 'Arroz';

UPDATE produtos SET 
  descricao = 'Feijão preto tipo 1, grãos selecionados, cozimento rápido e uniforme.',
  marca = 'Camil',
  estoque = 180,
  validade = DATE_ADD(CURDATE(), INTERVAL 365 DAY)
WHERE nome = 'Feijão';

UPDATE produtos SET 
  descricao = 'Óleo de soja refinado, 100% puro, ideal para frituras e preparo de alimentos.',
  marca = 'Liza',
  estoque = 95,
  validade = DATE_ADD(CURDATE(), INTERVAL 270 DAY)
WHERE nome = 'Óleo';

UPDATE produtos SET 
  descricao = 'Açúcar cristal, adoçante natural de alta pureza. Cristais uniformes.',
  marca = 'União',
  estoque = 110,
  validade = DATE_ADD(CURDATE(), INTERVAL 730 DAY)
WHERE nome = 'Açúcar';

UPDATE produtos SET 
  descricao = 'Macarrão espaguete premium, massa de sêmola de trigo durum. Al dente perfeito.',
  marca = 'Galo',
  estoque = 85,
  validade = DATE_ADD(CURDATE(), INTERVAL 900 DAY)
WHERE nome = 'Macarrão';

UPDATE produtos SET 
  descricao = 'Sal refinado iodado, essencial para o preparo de alimentos. Livre de impurezas.',
  marca = 'Cisne',
  estoque = 200,
  validade = DATE_ADD(CURDATE(), INTERVAL 1095 DAY)
WHERE nome = 'Sal';

-- AÇOUGUE
UPDATE produtos SET 
  descricao = 'Peito de frango congelado, sem osso e sem pele. Proteína magra e saudável.',
  marca = 'Sadia',
  estoque = 70,
  validade = DATE_ADD(CURDATE(), INTERVAL 120 DAY)
WHERE nome = 'Frango';

UPDATE produtos SET 
  descricao = 'Carne bovina de primeira qualidade, corte especial para churrasco e grelhados.',
  marca = 'Friboi',
  estoque = 45,
  validade = DATE_ADD(CURDATE(), INTERVAL 60 DAY)
WHERE nome = 'Carne';

-- LIMPEZA
UPDATE produtos SET 
  descricao = 'Detergente líquido concentrado, remove gordura com facilidade. Fragrância limão.',
  marca = 'Ypê',
  estoque = 130,
  validade = DATE_ADD(CURDATE(), INTERVAL 730 DAY)
WHERE nome = 'Detergente';

UPDATE produtos SET 
  descricao = 'Sabão em pó multiação, remove manchas difíceis e deixa roupas com cheiro suave.',
  marca = 'Omo',
  estoque = 75,
  validade = DATE_ADD(CURDATE(), INTERVAL 900 DAY)
WHERE nome = 'Sabão em Pó';

-- ===================================================================
-- FIM DA MIGRAÇÃO
-- ===================================================================
-- Executar este script no HeidiSQL:
-- 1. Abra o HeidiSQL
-- 2. Conecte ao banco railway
-- 3. Vá em Arquivo > Executar arquivo SQL
-- 4. Selecione este arquivo (migrate_produtos_detalhes.sql)
-- 5. Clique em Executar
-- ===================================================================

