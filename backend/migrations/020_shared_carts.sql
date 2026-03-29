-- Carrinhos compartilhados via WhatsApp
CREATE TABLE IF NOT EXISTS shared_carts (
  id VARCHAR(8) PRIMARY KEY,
  items JSONB NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  item_count INTEGER NOT NULL,
  created_by INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  views INTEGER DEFAULT 0,
  loads INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shared_carts_expires ON shared_carts(expires_at);
