import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { colors, fonts, formatPrice, formatProductName } from '../theme';
import Icon from '../components/Icon';
import { getSharedCart, trackSharedCartLoad } from '../lib/api';

export default function SharedCartPage({ onAdd, products = [] }) {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [sharedCart, setSharedCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getSharedCart(shareId);
        setSharedCart(data);
      } catch (err) {
        setError(err?.status === 404 ? 'expired' : 'network');
      } finally {
        setLoading(false);
      }
    }
    if (shareId) load();
  }, [shareId]);

  const handleAddAll = async () => {
    if (!sharedCart?.items || !onAdd) return;
    let count = 0;
    for (const item of sharedCart.items) {
      const productId = item.productId || item.id;
      const product = products.find(p => p.id === Number(productId));
      if (product) {
        const qty = item.quantity || 1;
        for (let i = 0; i < qty; i++) {
          onAdd(product.id);
        }
        count++;
      }
    }
    try { await trackSharedCartLoad(shareId); } catch {}
    setAdded(true);
    setTimeout(() => navigate('/pagamento'), 1200);
  };

  if (loading) return (
    <div style={{ padding: '60px 16px', textAlign: 'center' }}>
      <p style={{ color: colors.textMuted, fontFamily: fonts.text }}>Carregando lista...</p>
    </div>
  );

  if (error) return (
    <div style={{ padding: '60px 16px', textAlign: 'center' }}>
      <Icon name="clock" size={40} color={colors.textMuted} />
      <h2 style={{ fontSize: 16, fontWeight: 800, color: colors.white, margin: '16px 0 6px', fontFamily: fonts.text }}>
        {error === 'expired' ? 'Link expirado' : 'Erro de conexao'}
      </h2>
      <p style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.text, margin: '0 0 20px' }}>
        {error === 'expired'
          ? 'Este link ja expirou. Peca um novo link para quem compartilhou.'
          : 'Nao foi possivel carregar a lista. Tente novamente.'}
      </p>
      <button onClick={() => navigate('/')} style={{
        padding: '12px 24px', borderRadius: 12,
        background: colors.gold, border: 'none',
        color: colors.bgDeep, fontWeight: 800, fontSize: 13,
        cursor: 'pointer', fontFamily: fonts.text,
      }}>Ir para a loja</button>
    </div>
  );

  if (added) return (
    <div style={{ padding: '60px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u2705'}</div>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: colors.white, margin: '0 0 6px', fontFamily: fonts.text }}>
        Itens adicionados!
      </h2>
      <p style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.text }}>
        Redirecionando para o carrinho...
      </p>
    </div>
  );

  const items = sharedCart?.items || [];

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: colors.goldBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 10px', border: `1px solid ${colors.goldBorder}`,
        }}>
          <Icon name="cart" size={22} color={colors.gold} />
        </div>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: '0 0 4px', fontFamily: fonts.text }}>
          Lista compartilhada
        </h1>
        <p style={{ fontSize: 12, color: colors.textMuted, fontFamily: fonts.text, margin: 0 }}>
          {items.length} {items.length === 1 ? 'produto' : 'produtos'}
        </p>
      </div>

      {/* Lista de itens */}
      <div style={{
        background: colors.card, border: `1px solid ${colors.border}`,
        borderRadius: 14, overflow: 'hidden',
      }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            borderBottom: i < items.length - 1 ? `1px solid ${colors.border}` : 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 14,
            }}>
              {'\u{1F4E6}'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 12, fontWeight: 700, color: colors.white, margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: fonts.text,
              }}>
                {formatProductName(item.name || item.nome || 'Produto')}
              </p>
              <p style={{ fontSize: 10, color: colors.textMuted, margin: '1px 0 0', fontFamily: fonts.number }}>
                {item.quantity || 1}x {formatPrice(item.price || item.preco || 0)}
              </p>
            </div>
            <span style={{
              fontFamily: fonts.number, fontWeight: 800, fontSize: 12,
              color: colors.gold, flexShrink: 0,
            }}>
              {formatPrice((item.price || item.preco || 0) * (item.quantity || 1))}
            </span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 0', marginTop: 4,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: colors.white, fontFamily: fonts.text }}>Total</span>
        <span style={{ fontFamily: fonts.number, fontWeight: 900, fontSize: 22, color: colors.gold }}>
          {formatPrice(sharedCart?.total || 0)}
        </span>
      </div>

      {/* Botoes */}
      <button onClick={handleAddAll} style={{
        width: '100%', padding: 14, borderRadius: 12,
        background: colors.gold, border: 'none',
        color: colors.bgDeep, fontWeight: 800, fontSize: 14,
        cursor: 'pointer', fontFamily: fonts.text,
        boxShadow: '0 4px 16px rgba(226,184,74,0.3)',
        marginBottom: 8,
      }}>
        Adicionar tudo ao carrinho
      </button>

      <button onClick={() => navigate('/produtos')} style={{
        width: '100%', padding: 12, borderRadius: 12,
        background: 'rgba(255,255,255,0.07)', border: `1px solid ${colors.border}`,
        color: colors.white, fontWeight: 700, fontSize: 12,
        cursor: 'pointer', fontFamily: fonts.text,
      }}>
        Ver produtos
      </button>
    </div>
  );
}
