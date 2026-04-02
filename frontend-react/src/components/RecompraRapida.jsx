import React, { useState, useEffect } from 'react';
import { colors, fonts, formatPrice } from '../theme';
import Icon from './Icon';

export default function RecompraRapida({ onAdd }) {
  const [data, setData] = useState(null);
  const [added, setAdded] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetch('/api/recompra', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {});
  }, []);

  if (!data?.ultimo_pedido) return null;

  const { ultimo_pedido, mais_comprados } = data;

  const handleRepeatAll = () => {
    const available = ultimo_pedido.itens.filter(i => i.disponivel);
    let count = 0;
    available.forEach(item => {
      for (let i = 0; i < item.quantidade; i++) {
        onAdd(item.produto_id);
        count++;
      }
    });
    setAdded(count);
    setTimeout(() => setAdded(false), 3000);
  };

  const toggleExpanded = () => setExpanded(prev => !prev);

  return (
    <section style={styles.wrapper}>
      {/* Header — always visible */}
      <button onClick={toggleExpanded} style={styles.header}>
        <div style={styles.headerLeft}>
          <Icon name="clock" size={16} color={colors.gold} />
          <span style={styles.headerTitle}>Recompra rapida</span>
        </div>
        <span style={{
          ...styles.chevron,
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          <Icon name="chevron" size={14} color={colors.textMuted} />
        </span>
      </button>

      {expanded && (
        <div style={styles.content}>
          {/* Section 1: Repetir ultimo pedido */}
          <div style={styles.lastOrderCard}>
            <div style={styles.lastOrderInfo}>
              <span style={styles.sectionLabel}>Repetir ultimo pedido</span>
              <span style={styles.orderMeta}>
                {ultimo_pedido.data ? new Date(ultimo_pedido.data).toLocaleDateString('pt-BR') : ''} &middot; {ultimo_pedido.itens.length} {ultimo_pedido.itens.length === 1 ? 'item' : 'itens'} &middot; {formatPrice(ultimo_pedido.total || 0)}
              </span>
            </div>
            <button onClick={handleRepeatAll} style={styles.repeatBtn}>
              <Icon name="bag" size={14} color="#1F5C50" />
              <span style={styles.repeatBtnText}>Repetir tudo</span>
            </button>
          </div>

          {/* Toast */}
          {added && (
            <div style={styles.toast}>
              <Icon name="check" size={14} color={colors.gold} />
              <span style={styles.toastText}>{added} {added === 1 ? 'item adicionado' : 'itens adicionados'}</span>
            </div>
          )}

          {/* Section 2: Mais comprados */}
          {mais_comprados?.length > 0 && (
            <>
              <span style={styles.sectionLabel2}>Seus mais comprados</span>
              <div style={styles.scrollRow}>
                {mais_comprados.map(item => (
                  <div key={item.produto_id} style={{
                    ...styles.productCard,
                    opacity: item.disponivel ? 1 : 0.45,
                  }}>
                    {/* Image or placeholder */}
                    <div style={styles.productImg}>
                      {item.imagem_url ? (
                        <img
                          src={item.imagem_url}
                          alt={item.nome}
                          style={styles.productImgEl}
                          loading="lazy"
                        />
                      ) : (
                        <span style={styles.productEmoji}>🛒</span>
                      )}
                    </div>

                    {/* Name */}
                    <span style={styles.productName}>{item.nome}</span>

                    {/* Price */}
                    {item.disponivel ? (
                      <div style={styles.priceRow}>
                        <span style={styles.price}>{item.preco_atual != null ? formatPrice(item.preco_atual) : '—'}</span>
                      </div>
                    ) : (
                      <span style={styles.unavailable}>Indisponivel</span>
                    )}

                    {/* Add button */}
                    {item.disponivel && (
                      <button
                        onClick={() => onAdd(item.produto_id)}
                        style={styles.addBtn}
                        aria-label={`Adicionar ${item.nome}`}
                      >
                        <Icon name="plus" size={14} color="#1F5C50" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

const styles = {
  wrapper: {
    marginBottom: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '10px 0',
    cursor: 'pointer',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: colors.white,
    fontFamily: fonts?.heading || 'inherit',
    fontSize: 15,
    fontWeight: 600,
  },
  chevron: {
    display: 'inline-flex',
    transition: 'transform 0.2s ease',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  /* Section 1 — Last order */
  lastOrderCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: '12px 14px',
  },
  lastOrderInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  sectionLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: 600,
  },
  orderMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  repeatBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: colors.gold,
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  repeatBtnText: {
    color: '#1F5C50',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },

  /* Toast */
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: colors.goldBg,
    border: `1px solid ${colors.goldBorder}`,
    borderRadius: 8,
    padding: '8px 12px',
  },
  toastText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: 500,
  },

  /* Section 2 — Most bought */
  sectionLabel2: {
    color: colors.white,
    fontSize: 13,
    fontWeight: 600,
    marginTop: 4,
  },
  scrollRow: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    paddingBottom: 4,
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',        // Firefox
    msOverflowStyle: 'none',       // IE/Edge
  },
  productCard: {
    flex: '0 0 100px',
    width: 100,
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  productImg: {
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  productImgEl: {
    width: 40,
    height: 40,
    objectFit: 'cover',
    borderRadius: 8,
  },
  productEmoji: {
    fontSize: 20,
  },
  productName: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 500,
    textAlign: 'center',
    lineHeight: '13px',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    width: '100%',
  },
  priceRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 1,
  },
  oldPrice: {
    color: colors.textMuted,
    fontSize: 9,
    textDecoration: 'line-through',
  },
  price: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: 700,
  },
  unavailable: {
    color: colors.textMuted,
    fontSize: 9,
    fontStyle: 'italic',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: colors.gold,
    border: 'none',
    cursor: 'pointer',
    marginTop: 2,
  },
};
