-- ============================================
-- 022: Mercado Pago webhook-first (persistencia + auditoria)
-- ============================================

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_external_reference VARCHAR(100) NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_preference_id VARCHAR(120) NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_status VARCHAR(32) NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_status_detail VARCHAR(120) NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_payment_status_internal VARCHAR(32) NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_data_criacao_pagamento TIMESTAMP NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_data_aprovacao_pagamento TIMESTAMP NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_last_webhook_at TIMESTAMP NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_last_reconciled_at TIMESTAMP NULL;

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS mp_payload_ultimo JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_mp_payment_id_mp
  ON pedidos (mp_payment_id_mp);

CREATE INDEX IF NOT EXISTS idx_pedidos_mp_external_reference
  ON pedidos (mp_external_reference);

CREATE INDEX IF NOT EXISTS idx_pedidos_mp_status
  ON pedidos (mp_status);

CREATE INDEX IF NOT EXISTS idx_pedidos_mp_last_webhook_at
  ON pedidos (mp_last_webhook_at);

CREATE TABLE IF NOT EXISTS pedido_pagamento_auditoria (
  id BIGSERIAL PRIMARY KEY,
  pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  mp_payment_id VARCHAR(64) NULL,
  mp_external_reference VARCHAR(100) NULL,
  status_gateway_anterior VARCHAR(32) NULL,
  status_gateway_novo VARCHAR(32) NULL,
  status_interno_anterior VARCHAR(32) NULL,
  status_interno_novo VARCHAR(32) NULL,
  origem VARCHAR(64) NOT NULL DEFAULT 'desconhecido',
  motivo VARCHAR(80) NOT NULL DEFAULT 'indefinido',
  event_id VARCHAR(120) NULL,
  request_id VARCHAR(120) NULL,
  idempotency_key VARCHAR(255) NULL,
  aplicado BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_pagamento_auditoria_pedido_data
  ON pedido_pagamento_auditoria (pedido_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pedido_pagamento_auditoria_payment
  ON pedido_pagamento_auditoria (mp_payment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pedido_pagamento_auditoria_origem_data
  ON pedido_pagamento_auditoria (origem, created_at DESC);
