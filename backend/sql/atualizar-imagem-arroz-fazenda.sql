-- Atualizar imagem do produto "ARROZ FAZENDA KG BRANCO" (ID 2973)
-- Foto tirada na loja, salva em /img/produtos/arroz-fazenda-1kg.jpg
-- IMPORTANTE: Antes de rodar, salve a foto em frontend-react/public/img/produtos/arroz-fazenda-1kg.jpg

UPDATE produtos
SET imagem_url = '/img/produtos/arroz-fazenda-1kg.jpg'
WHERE id = 2973;

-- Verificar
SELECT id, nome, imagem_url FROM produtos WHERE id = 2973;
