import React from 'react';
import { colors, fonts, radius } from '../../styles/tokens';
import { Btn, Badge, InputField } from '../ui';

const BRL = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export default function CatalogScreen({
  produtoForm, setProdutoForm,
  buscandoCodigo, handleBuscarProdutoPorCodigoBarras,
  salvandoProduto, handleCadastrarProduto,
  produtos, handleExcluirProduto,
  paginacaoProdutos, carregandoProdutos, carregarProdutosPagina,
  SmartImage,
}) {
  const setField = (key) => (val) => setProdutoForm((f) => ({ ...f, [key]: val }));
  const setFieldEvt = (key) => (e) => setProdutoForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Form: Novo Produto ── */}
      <form
        onSubmit={handleCadastrarProduto}
        style={{
          padding: 18, borderRadius: radius.lg,
          background: colors.bgCard, border: `1px solid ${colors.border}`,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo Produto
        </h3>

        {/* Barcode row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <InputField label="CODIGO DE BARRAS (EAN)" value={produtoForm.codigo_barras} onChange={setField('codigo_barras')} placeholder="7891234567890" style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <Btn onClick={handleBuscarProdutoPorCodigoBarras} disabled={buscandoCodigo}>
              {buscandoCodigo ? 'Buscando...' : 'Buscar produto'}
            </Btn>
          </div>
        </div>

        {/* Name + Brand */}
        <div style={{ display: 'flex', gap: 8 }}>
          <InputField label="NOME" value={produtoForm.nome} onChange={setField('nome')} placeholder="Nome do produto" style={{ flex: 2 }} />
          <InputField label="MARCA" value={produtoForm.marca} onChange={setField('marca')} placeholder="Marca" style={{ flex: 1 }} />
        </div>

        {/* Description */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: colors.dim, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>DESCRICAO</label>
          <textarea
            rows={2}
            value={produtoForm.descricao}
            onChange={setFieldEvt('descricao')}
            placeholder="Descricao do produto"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: radius.md,
              background: colors.bgCard, border: `1px solid ${colors.border}`,
              color: colors.white, fontSize: 13, fontFamily: fonts.text,
              outline: 'none', resize: 'vertical', minHeight: 48,
            }}
          />
        </div>

        {/* Price + Category + Unit */}
        <div style={{ display: 'flex', gap: 8 }}>
          <InputField label="PRECO" type="number" step="0.01" min="0" value={produtoForm.preco} onChange={setField('preco')} placeholder="R$ 0,00" style={{ flex: 1 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: colors.dim, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>CATEGORIA</label>
            <select
              value={produtoForm.categoria}
              onChange={setFieldEvt('categoria')}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: radius.md,
                background: colors.bgCard, border: `1px solid ${colors.border}`,
                color: colors.white, fontSize: 13, fontFamily: fonts.text, outline: 'none',
              }}
            >
              <option value="">Selecione</option>
              {['Agua', 'Agua 20L', 'Arroz e Feijao', 'Bebidas', 'Biscoitos', 'Carnes', 'Cereais', 'Congelados', 'Frios', 'Higiene', 'Hortifruti', 'Laticinios', 'Limpeza', 'Massas', 'Mercearia', 'Padaria', 'Pet', 'Temperos'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: colors.dim, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>UNIDADE</label>
            <select
              value={produtoForm.unidade}
              onChange={setFieldEvt('unidade')}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: radius.md,
                background: colors.bgCard, border: `1px solid ${colors.border}`,
                color: colors.white, fontSize: 13, fontFamily: fonts.text, outline: 'none',
              }}
            >
              {['un', 'kg', 'g', 'lt', 'ml', 'cx', 'pct', 'dz'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Image URL + Ref */}
        <div style={{ display: 'flex', gap: 8 }}>
          <InputField label="URL DA IMAGEM" value={produtoForm.imagem} onChange={setField('imagem')} placeholder="https://..." style={{ flex: 2 }} />
          <InputField label="REF. VISUAL" value={produtoForm.emoji} onChange={setField('emoji')} placeholder="0" style={{ flex: 1 }} />
        </div>

        {/* Image preview */}
        {produtoForm.imagem && SmartImage && (
          <SmartImage
            src={produtoForm.imagem}
            alt="Previa"
            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: radius.md, border: `1px solid ${colors.border}` }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}

        {/* Submit */}
        <Btn gold type="submit" disabled={salvandoProduto} style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}>
          {salvandoProduto ? 'Salvando...' : 'Salvar produto'}
        </Btn>
      </form>

      {/* ── Search bar ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: radius.md,
          background: colors.bgCard, border: `1px solid ${colors.border}`,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span style={{ fontSize: 12, color: colors.dim }}>Buscar produto...</span>
        </div>
      </div>

      {/* ── Table header ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px 80px 60px 70px', gap: 8, padding: '8px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: colors.dim }}>
        <span>ID</span><span>PRODUTO</span><span>CATEG.</span><span>PRECO</span><span>EST.</span><span></span>
      </div>

      {/* ── Product rows ── */}
      {carregandoProdutos ? (
        <p style={{ textAlign: 'center', padding: 20, color: colors.dim, fontSize: 12 }}>Carregando produtos...</p>
      ) : produtos.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 20, color: colors.dim, fontSize: 12 }}>Nenhum produto cadastrado nesta pagina.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {produtos.map((produto) => {
            const qty = Number(produto.estoque ?? 0);
            const estoqueColor = qty === 0 ? colors.red : qty <= 5 ? colors.orange : colors.green;
            return (
              <div
                key={produto.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '50px 1fr 100px 80px 60px 70px',
                  gap: 8, alignItems: 'center',
                  padding: '10px 12px',
                  borderBottom: `1px solid ${colors.borderDim}`,
                  fontSize: 12,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontFamily: fonts.numbers, color: colors.dim, fontSize: 11 }}>{produto.id}</span>
                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {produto.nome}
                </span>
                <span>{produto.categoria ? <Badge tone="muted" label={produto.categoria} /> : <span style={{ color: colors.dim }}>—</span>}</span>
                <span style={{ fontFamily: fonts.numbers, fontWeight: 600, color: colors.gold }}>{BRL(produto.preco)}</span>
                <span style={{ fontFamily: fonts.numbers, fontWeight: 700, color: estoqueColor }}>{qty}</span>
                <div style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleExcluirProduto(produto.id)}
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: colors.redBg, border: `1px solid ${colors.redBorder}`,
                      color: colors.red, fontSize: 14, fontWeight: 700,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    x
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${colors.borderDim}` }}>
        <span style={{ fontSize: 11, color: colors.dim, fontFamily: fonts.numbers }}>
          Pagina {paginacaoProdutos.pagina}/{paginacaoProdutos.total_paginas} . {paginacaoProdutos.total} produto(s)
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn onClick={() => { void carregarProdutosPagina(paginacaoProdutos.pagina - 1); }} disabled={carregandoProdutos || paginacaoProdutos.pagina <= 1}>
            ← Anterior
          </Btn>
          <Btn onClick={() => { void carregarProdutosPagina(paginacaoProdutos.pagina + 1); }} disabled={carregandoProdutos || !paginacaoProdutos.tem_mais}>
            Proxima →
          </Btn>
        </div>
      </div>
    </div>
  );
}
