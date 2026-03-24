-- ============================================
-- 000: Schema inicial PostgreSQL (base operacional)
-- ============================================

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha VARCHAR(255) NOT NULL,
  telefone VARCHAR(20) NULL,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

CREATE TABLE IF NOT EXISTS enderecos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rua VARCHAR(255) NULL,
  logradouro VARCHAR(255) NULL,
  numero VARCHAR(20) NULL,
  complemento VARCHAR(120) NULL,
  referencia VARCHAR(180) NULL,
  bairro VARCHAR(120) NULL,
  cidade VARCHAR(120) NULL,
  estado VARCHAR(2) NULL,
  cep VARCHAR(10) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enderecos_usuario_id ON enderecos(usuario_id);

CREATE TABLE IF NOT EXISTS produtos (
  id BIGSERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  nome_externo VARCHAR(255) NULL,
  descricao TEXT NULL,
  marca VARCHAR(100) NULL,
  preco NUMERIC(10, 2) NOT NULL DEFAULT 0,
  preco_promocional NUMERIC(10, 2) NULL,
  preco_tabela NUMERIC(10, 2) NULL,
  unidade VARCHAR(20) NULL DEFAULT 'un',
  categoria VARCHAR(80) NULL DEFAULT 'geral',
  departamento VARCHAR(100) NULL,
  secao_exibicao VARCHAR(100) NULL,
  emoji VARCHAR(20) NULL,
  estoque INTEGER NOT NULL DEFAULT 0,
  validade DATE NULL,
  codigo_interno VARCHAR(64) NULL,
  codigo_barras VARCHAR(32) NULL,
  imagem_url TEXT NULL,
  enrichment_status VARCHAR(30) NOT NULL DEFAULT 'pendente',
  enrichment_provider VARCHAR(80) NULL,
  enrichment_last_attempt_at TIMESTAMP NULL,
  enrichment_updated_at TIMESTAMP NULL,
  enrichment_last_error VARCHAR(255) NULL,
  ultima_importacao_em TIMESTAMP NULL,
  ultima_atualizacao_preco_em TIMESTAMP NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_departamento ON produtos(departamento);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras ON produtos(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo_interno ON produtos(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);

CREATE TABLE IF NOT EXISTS pedidos (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10, 2) NULL,
  frete NUMERIC(10, 2) NULL,
  desconto NUMERIC(10, 2) NULL,
  taxa_servico NUMERIC(10, 2) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pendente',
  forma_pagamento VARCHAR(40) NOT NULL DEFAULT 'pix',
  tipo_entrega VARCHAR(20) NOT NULL DEFAULT 'entrega',
  mp_payment_id VARCHAR(64) NULL,
  mp_payment_id_mp VARCHAR(64) NULL,
  pix_status VARCHAR(32) NULL,
  pix_qr_data TEXT NULL,
  pix_qr_base64 TEXT NULL,
  pix_id VARCHAR(64) NULL,
  pix_codigo TEXT NULL,
  pix_qrcode TEXT NULL,
  observacoes TEXT NULL,
  entrega_status VARCHAR(32) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  pago_em TIMESTAMP NULL,
  em_preparo_em TIMESTAMP NULL,
  pronto_em TIMESTAMP NULL,
  saiu_entrega_em TIMESTAMP NULL,
  entregue_em TIMESTAMP NULL,
  retirado_em TIMESTAMP NULL,
  cancelado_em TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_pix_id ON pedidos(pix_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_criado_em ON pedidos(criado_em);

CREATE TABLE IF NOT EXISTS pedido_itens (
  id BIGSERIAL PRIMARY KEY,
  pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id BIGINT NULL REFERENCES produtos(id) ON DELETE SET NULL,
  nome_produto VARCHAR(255) NOT NULL,
  preco NUMERIC(10, 2) NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  subtotal NUMERIC(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido_id ON pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_produto_id ON pedido_itens(produto_id);

CREATE TABLE IF NOT EXISTS cupons (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  descricao VARCHAR(255) NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'percentual',
  valor NUMERIC(10, 2) NOT NULL,
  valor_minimo NUMERIC(10, 2) NOT NULL DEFAULT 0,
  validade DATE NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  uso_maximo INTEGER NULL,
  uso_atual INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cupons_ativo ON cupons(ativo);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON cupons(codigo);

CREATE TABLE IF NOT EXISTS cupons_usados (
  id BIGSERIAL PRIMARY KEY,
  cupom_id BIGINT NOT NULL REFERENCES cupons(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  usado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cupons_usados_usuario_id ON cupons_usados(usuario_id);

CREATE TABLE IF NOT EXISTS avaliacoes (
  id BIGSERIAL PRIMARY KEY,
  produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nota INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_produto_id ON avaliacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_usuario_id ON avaliacoes(usuario_id);

CREATE TABLE IF NOT EXISTS banners (
  id BIGSERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  imagem_url TEXT NOT NULL,
  link_url TEXT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_ativo_ordem ON banners(ativo, ordem);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  acao VARCHAR(80) NOT NULL,
  entidade VARCHAR(40) NULL,
  entidade_id BIGINT NULL,
  detalhes JSONB NULL,
  admin_usuario VARCHAR(80) NOT NULL DEFAULT 'admin',
  ip VARCHAR(45) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_acao ON admin_audit_log(acao);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entidade ON admin_audit_log(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_criado_em ON admin_audit_log(criado_em);
