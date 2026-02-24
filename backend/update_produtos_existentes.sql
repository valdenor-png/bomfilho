-- ===================================================================
-- MIGRAÇÃO: Atualizar Produtos Existentes com Descrições
-- ===================================================================
-- Atualiza os produtos que já existem no banco com descrições individuais
-- ===================================================================

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
  descricao = 'Cenoura fresca e crocante, rica em betacaroteno. Perfeita para saladas, cozidos e sucos.',
  marca = 'Hortifruti Natural',
  estoque = 70,
  validade = DATE_ADD(CURDATE(), INTERVAL 12 DAY)
WHERE nome = 'Cenoura';

-- BEBIDAS
UPDATE produtos SET 
  descricao = 'Leite integral UHT 1 litro, fonte de cálcio e proteínas. Pasteurizado e seguro.',
  marca = 'Italac',
  estoque = 120,
  validade = DATE_ADD(CURDATE(), INTERVAL 90 DAY)
WHERE nome = 'Leite UHT';

UPDATE produtos SET 
  descricao = 'Café torrado e moído tradicional 500g, 100% arábica. Sabor encorpado e aroma intenso.',
  marca = 'Pilão',
  estoque = 55,
  validade = DATE_ADD(CURDATE(), INTERVAL 180 DAY)
WHERE nome = 'Café 500g';

-- MERCEARIA
UPDATE produtos SET 
  descricao = 'Arroz branco tipo 1, 5kg, grãos selecionados e soltinhos. Rende muito e não empapa.',
  marca = 'Tio João',
  estoque = 200,
  validade = DATE_ADD(CURDATE(), INTERVAL 365 DAY)
WHERE nome = 'Arroz 5kg';

UPDATE produtos SET 
  descricao = 'Feijão preto tipo 1, 1kg, grãos selecionados, cozimento rápido e uniforme.',
  marca = 'Camil',
  estoque = 180,
  validade = DATE_ADD(CURDATE(), INTERVAL 365 DAY)
WHERE nome = 'Feijão 1kg';

UPDATE produtos SET 
  descricao = 'Óleo de soja refinado 900ml, 100% puro, ideal para frituras e preparo de alimentos.',
  marca = 'Liza',
  estoque = 95,
  validade = DATE_ADD(CURDATE(), INTERVAL 270 DAY)
WHERE nome = 'Óleo de Soja 900ml';

UPDATE produtos SET 
  descricao = 'Açúcar cristal 1kg, adoçante natural de alta pureza. Cristais uniformes.',
  marca = 'União',
  estoque = 110,
  validade = DATE_ADD(CURDATE(), INTERVAL 730 DAY)
WHERE nome = 'Açúcar 1kg';

UPDATE produtos SET 
  descricao = 'Macarrão espaguete premium 500g, massa de sêmola de trigo durum. Al dente perfeito.',
  marca = 'Galo',
  estoque = 85,
  validade = DATE_ADD(CURDATE(), INTERVAL 900 DAY)
WHERE nome = 'Macarrão 500g';

UPDATE produtos SET 
  descricao = 'Pão francês fresquinho do dia, 6 unidades. Crocante por fora, macio por dentro.',
  marca = 'Padaria Bom Filho',
  estoque = 200,
  validade = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
WHERE nome = 'Pão Francês (6)';

-- AÇOUGUE
UPDATE produtos SET 
  descricao = 'Peito de frango congelado 1kg, sem osso e sem pele. Proteína magra e saudável.',
  marca = 'Sadia',
  estoque = 70,
  validade = DATE_ADD(CURDATE(), INTERVAL 120 DAY)
WHERE nome = 'Frango Congelado 1kg';

UPDATE produtos SET 
  descricao = 'Carne bovina de primeira qualidade 1kg, corte especial para churrasco e grelhados.',
  marca = 'Friboi',
  estoque = 45,
  validade = DATE_ADD(CURDATE(), INTERVAL 60 DAY)
WHERE nome = 'Carne Bovina 1kg';

-- LIMPEZA
UPDATE produtos SET 
  descricao = 'Detergente líquido concentrado 500ml, remove gordura com facilidade. Fragrância limão.',
  marca = 'Ypê',
  estoque = 130,
  validade = DATE_ADD(CURDATE(), INTERVAL 730 DAY)
WHERE nome = 'Detergente 500ml';

UPDATE produtos SET 
  descricao = 'Sabão em pó multiação 1kg, remove manchas difíceis e deixa roupas com cheiro suave.',
  marca = 'Omo',
  estoque = 75,
  validade = DATE_ADD(CURDATE(), INTERVAL 900 DAY)
WHERE nome = 'Sabão em Pó 1kg';

-- ===================================================================
-- FIM DA ATUALIZAÇÃO
-- ===================================================================
SELECT 'Migração concluída! Todos os produtos foram atualizados.' AS Status;
