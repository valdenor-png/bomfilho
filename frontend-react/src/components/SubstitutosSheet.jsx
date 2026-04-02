import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { colors, fonts, formatPrice } from '../theme';
import Icon from './Icon';

const TRANSITION_MS = 300;

export default function SubstitutosSheet({ productId, productName, isOpen, onClose, onAdd }) {
  const [substitutos, setSubstitutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addedId, setAddedId] = useState(null);
  const [visible, setVisible] = useState(false);

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      // Small delay so the DOM renders before the transition starts
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  // Fetch substitutes when opened
  useEffect(() => {
    if (!isOpen || !productId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setSubstitutos([]);
    setAddedId(null);

    fetch(`/api/produtos/${productId}/substitutos`)
      .then((r) => {
        if (!r.ok) throw new Error('Falha ao buscar substitutos');
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setSubstitutos(data.substitutos || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, productId]);

  const handleAdd = useCallback((id) => {
    setAddedId(id);
    onAdd?.(id);
    setTimeout(() => setAddedId(null), 1200);
  }, [onAdd]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose?.();
  }, [onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: visible ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
        transition: `background ${TRANSITION_MS}ms ease`,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {/* Sheet */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '70vh',
          background: colors.bgDark,
          borderRadius: '18px 18px 0 0',
          border: `1px solid ${colors.border}`,
          borderBottom: 'none',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${TRANSITION_MS}ms cubic-bezier(.4,.0,.2,1)`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 20px 12px',
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: fonts.text,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: colors.gold,
              marginBottom: 4,
            }}>
              Alternativas disponiveis
            </div>
            <div style={{
              fontFamily: fonts.text,
              fontSize: 15,
              fontWeight: 700,
              color: colors.white,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {productName || 'Produto'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: 10,
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            <Icon name="close" size={16} color={colors.textSecondary} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px 24px',
        }}>
          {loading && (
            <div style={{
              textAlign: 'center',
              padding: '32px 0',
              color: colors.textSecondary,
              fontFamily: fonts.text,
              fontSize: 14,
            }}>
              Buscando alternativas...
            </div>
          )}

          {error && (
            <div style={{
              textAlign: 'center',
              padding: '32px 0',
              color: colors.error,
              fontFamily: fonts.text,
              fontSize: 14,
            }}>
              {error}
            </div>
          )}

          {!loading && !error && substitutos.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '32px 0',
              color: colors.textMuted,
              fontFamily: fonts.text,
              fontSize: 14,
            }}>
              Nenhuma alternativa encontrada
            </div>
          )}

          {!loading && !error && substitutos.map((s) => {
            const isAdded = addedId === s.id;
            const isCheaper = s.diferenca.startsWith('-');
            const isEqual = s.diferenca === 'Mesmo preco';

            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: 14,
                  marginBottom: 10,
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 14,
                  backdropFilter: 'blur(10px)',
                }}
              >
                {/* Image or placeholder */}
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  background: colors.cardHover,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {s.imagem_url ? (
                    <img
                      src={s.imagem_url}
                      alt={s.nome}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 26 }}>📦</span>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: fonts.text,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.white,
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {s.nome}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontFamily: fonts.number,
                      fontSize: 15,
                      fontWeight: 700,
                      color: colors.gold,
                    }}>
                      {formatPrice(s.preco)}
                    </span>
                    <span style={{
                      fontFamily: fonts.number,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: isEqual ? colors.warnBg
                        : isCheaper ? colors.successBg : colors.errorBg,
                      color: isEqual ? colors.warn
                        : isCheaper ? colors.success : colors.error,
                    }}>
                      {s.diferenca}
                    </span>
                  </div>
                </div>

                {/* Add button */}
                <button
                  onClick={() => handleAdd(s.id)}
                  disabled={isAdded}
                  style={{
                    background: isAdded ? colors.successBg : colors.gold,
                    color: isAdded ? colors.success : colors.bgDeep,
                    border: 'none',
                    borderRadius: 10,
                    padding: '8px 14px',
                    fontFamily: fonts.text,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isAdded ? 'default' : 'pointer',
                    flexShrink: 0,
                    transition: 'all 200ms ease',
                  }}
                >
                  {isAdded ? 'Adicionado!' : 'Adicionar'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
