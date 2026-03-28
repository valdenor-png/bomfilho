-- ============================================
-- 023: Índices de performance para sort mais-vendidos
-- ============================================
-- O sort mais-vendidos executa este LEFT JOIN subquery em toda requisição
-- que não está no cache:
--
--   LEFT JOIN (
--     SELECT pi.produto_id,
--            COUNT(DISTINCT pi.pedido_id) AS total_pedidos,
--            COALESCE(SUM(pi.quantidade), 0) AS total_quantidade,
--            MAX(ped.criado_em) AS ultima_venda_em
--     FROM pedido_itens pi
--     INNER JOIN pedidos ped ON ped.id = pi.pedido_id
--     WHERE ped.status <> 'cancelado'
--     GROUP BY pi.produto_id
--   ) vendas_produtos ON vendas_produtos.produto_id = p.id
--
-- Com os índices simples existentes (idx_pedido_itens_produto_id e
-- idx_pedido_itens_pedido_id), o PostgreSQL faz dois index scans separados
-- e os combina (bitmap AND). O índice composto abaixo permite um único
-- index scan cobrindo tanto o GROUP BY (produto_id) quanto o JOIN
-- (pedido_id), eliminando a necessidade de heap fetch nos pedido_itens.
-- ============================================

-- Índice composto cobrindo GROUP BY produto_id + JOIN pedido_id
-- Permite que o PostgreSQL resolva o subquery com um index-only scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pedido_itens_produto_pedido
  ON pedido_itens(produto_id, pedido_id);

-- Índice parcial em pedidos para o JOIN filtrado por status.
-- Como 'cancelado' é a única exclusão, um partial index nos pedidos
-- não-cancelados reduz o tamanho do índice e acelera o bitmap scan.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pedidos_id_status_nao_cancelado
  ON pedidos(id)
  WHERE status <> 'cancelado';
