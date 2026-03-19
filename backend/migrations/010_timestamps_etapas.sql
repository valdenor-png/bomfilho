-- =============================================================
-- Migration: Timestamps por etapa do pedido (métricas operacionais)
-- =============================================================
-- Adiciona colunas de timestamp para cada etapa do fluxo do pedido.
-- Permite medir tempo de preparo, rota, espera e total.
-- Não afeta dados existentes: pendentes recebem NULL.
-- =============================================================

ALTER TABLE pedidos
  ADD COLUMN pago_em DATETIME NULL DEFAULT NULL AFTER criado_em,
  ADD COLUMN em_preparo_em DATETIME NULL DEFAULT NULL AFTER pago_em,
  ADD COLUMN pronto_em DATETIME NULL DEFAULT NULL AFTER em_preparo_em,
  ADD COLUMN saiu_entrega_em DATETIME NULL DEFAULT NULL AFTER pronto_em,
  ADD COLUMN entregue_em DATETIME NULL DEFAULT NULL AFTER saiu_entrega_em,
  ADD COLUMN retirado_em DATETIME NULL DEFAULT NULL AFTER entregue_em,
  ADD COLUMN cancelado_em DATETIME NULL DEFAULT NULL AFTER retirado_em;

-- Índice composto para consultas de métricas operacionais
ALTER TABLE pedidos
  ADD INDEX idx_pedidos_metricas (status, pronto_em, saiu_entrega_em, entregue_em);
