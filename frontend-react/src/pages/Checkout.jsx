import React from 'react';
// pages/Checkout.jsx — Checkout completo (4 etapas + confirmação)
// Fluxo: Carrinho → Entrega → Verificação (espera admin) → Pagamento → Confirmado
// Props: cart, products, updateQty(id, qty), removeItem(id), onGoHome
// Integrar com: API de pedidos, CartContext, polling de status

import { useState, useEffect } from 'react';
import { colors, fonts, formatPrice, formatProductName } from '../theme';
import Icon, { categoryIcons } from '../components/Icon';
import SaveCartCTA from '../components/cart/SaveCartCTA';
import { createSharedCart, validarCupom } from '../lib/api';
import SaveCartModal from '../components/cart/SaveCartModal';
import { useSavedLists } from '../hooks/useSavedLists';
import DeliverySlots, { DayPicker } from '../components/DeliverySlots';

const stepLabels = ['Carrinho', 'Entrega', 'Verificar', 'Pagar'];

/* ===== PROGRESS BAR ===== */
function ProgressBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0' }}>
      {stepLabels.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: done || active ? colors.gold : colors.card,
                border: done || active ? 'none' : `1px solid ${colors.border}`,
                color: done || active ? colors.bgDeep : colors.textMuted,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800, fontFamily: fonts.number,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: 7, fontWeight: 600, whiteSpace: 'nowrap',
                color: done || active ? colors.gold : colors.textMuted,
                fontFamily: fonts.text,
              }}>
                {label}
              </span>
            </div>
            {i < 3 && (
              <div style={{
                flex: 1, height: 2, margin: '0 3px', marginBottom: 12,
                background: done ? colors.gold : colors.border,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ===== STEP 1: CARRINHO ===== */
function CartStep({ cart, products, updateQty, onNext }) {
  const [sharing, setSharing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const items = Object.entries(cart).map(([id, qty]) => ({
    product: products.find(p => p.id === Number(id)),
    qty,
  })).filter(i => i.product);

  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const discount = appliedCoupon?.desconto || 0;
  const total = Math.max(0, subtotal - discount);
  const count = items.reduce((s, i) => s + i.qty, 0);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const result = await validarCupom(couponCode.trim(), subtotal);
      if (result.valido) {
        setAppliedCoupon(result);
        setCouponCode('');
      }
    } catch (err) {
      setCouponError(err?.message || err?.erro || 'Cupom invalido.');
    } finally {
      setCouponLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <Icon name="cart" size={48} color={colors.textMuted} strokeWidth={1} />
        <h3 style={{ color: colors.white, fontSize: 16, fontWeight: 800, margin: '16px 0 6px', fontFamily: fonts.text }}>
          Seu carrinho esta vazio
        </h3>
        <p style={{ color: colors.textMuted, fontSize: 12, margin: 0, fontFamily: fonts.text }}>
          Adicione produtos para continuar
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 10, color: colors.textMuted, marginBottom: 8 }}>
        {items.length} produtos | <span style={{ fontFamily: fonts.number }}>{count}</span> itens
      </p>

      {items.map(({ product, qty }) => (
        <div key={product.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 0', borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: colors.card, border: `1px solid ${colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name={categoryIcons[product.category] || 'package'} size={15} color={colors.textMuted} strokeWidth={1.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontSize: 11.5, fontWeight: 700, color: colors.white, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: fonts.text,
            }}>
              {formatProductName(product.name)}
            </p>
            <p style={{ fontSize: 10, color: colors.textSecondary, fontFamily: fonts.number, margin: '1px 0 0' }}>
              {formatPrice(product.price)}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button onClick={() => updateQty(product.id, qty - 1)} style={{
              width: 22, height: 22, borderRadius: 5,
              border: `1px solid ${colors.border}`, background: 'transparent',
              color: colors.textSecondary, cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>−</button>
            <span style={{ fontFamily: fonts.number, fontWeight: 700, fontSize: 12, color: colors.white, minWidth: 14, textAlign: 'center' }}>
              {qty}
            </span>
            <button onClick={() => updateQty(product.id, qty + 1)} style={{
              width: 22, height: 22, borderRadius: 5,
              border: 'none', background: colors.gold, color: colors.bgDeep,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
          </div>
          <span style={{
            fontFamily: fonts.number, fontWeight: 800, fontSize: 12,
            color: colors.gold, minWidth: 55, textAlign: 'right',
          }}>
            {formatPrice(product.price * qty)}
          </span>
        </div>
      ))}

      {/* Cupom */}
      <div style={{ marginTop: 12 }}>
        {appliedCoupon ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 12,
            background: 'rgba(226,184,74,0.1)', border: `1px solid ${colors.goldBorder}`,
          }}>
            <span style={{ fontSize: 15 }}>{'\u{1F3F7}\uFE0F'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: colors.gold, margin: 0, fontFamily: fonts.number }}>
                {appliedCoupon.codigo}
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: '1px 0 0', fontFamily: fonts.text }}>
                {appliedCoupon.descricao}
              </p>
            </div>
            <span style={{ fontFamily: fonts.number, fontWeight: 800, fontSize: 13, color: '#5AE4A7', flexShrink: 0 }}>
              -{formatPrice(appliedCoupon.desconto)}
            </span>
            <button onClick={() => setAppliedCoupon(null)} style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'rgba(255,255,255,0.07)', border: `1px solid ${colors.border}`,
              color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>x</button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={couponCode}
                onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                placeholder="Codigo do cupom"
                maxLength={20}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', border: `1px solid ${colors.border}`,
                  color: colors.white, fontSize: 12, fontFamily: fonts.text,
                  outline: 'none', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}
              />
              <button
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim() || couponLoading}
                style={{
                  padding: '9px 16px', borderRadius: 10,
                  background: colors.gold, border: 'none',
                  color: colors.bgDeep, fontWeight: 800, fontSize: 12,
                  cursor: 'pointer', fontFamily: fonts.text,
                  opacity: (!couponCode.trim() || couponLoading) ? 0.5 : 1,
                }}
              >
                {couponLoading ? '...' : 'Aplicar'}
              </button>
            </div>
            {couponError && (
              <p style={{ fontSize: 10, color: '#F87171', fontWeight: 600, margin: '4px 0 0', fontFamily: fonts.text }}>
                {couponError}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Resumo */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `2px solid ${colors.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: colors.textMuted, fontSize: 11 }}>Subtotal</span>
          <span style={{ color: colors.textSecondary, fontFamily: fonts.number, fontSize: 11 }}>{formatPrice(subtotal)}</span>
        </div>
        {appliedCoupon && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#5AE4A7', fontSize: 11, fontWeight: 600 }}>Desconto ({appliedCoupon.codigo})</span>
            <span style={{ color: '#5AE4A7', fontFamily: fonts.number, fontSize: 11, fontWeight: 700 }}>-{formatPrice(discount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: colors.textMuted, fontSize: 11 }}>Frete</span>
          <span style={{ color: colors.success, fontFamily: fonts.number, fontSize: 11, fontWeight: 600 }}>Gratis</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ color: colors.white, fontWeight: 600, fontSize: 13 }}>Total</span>
          <span style={{ color: colors.gold, fontFamily: fonts.number, fontWeight: 900, fontSize: 20 }}>{formatPrice(total)}</span>
        </div>
      </div>

      <button onClick={onNext} style={{
        width: '100%', marginTop: 12, padding: 13,
        background: colors.gold, border: 'none', borderRadius: 12,
        color: colors.bgDeep, fontWeight: 800, fontSize: 13,
        cursor: 'pointer', fontFamily: fonts.text,
      }}>
        Ir para entrega
      </button>

      {/* Compartilhar via WhatsApp */}
      <button
        disabled={sharing}
        onClick={async () => {
          setSharing(true);
          try {
            const cartItems = items.map(({ product, qty }) => ({
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: qty,
              category: product.category,
            }));
            const data = await createSharedCart({ items: cartItems, total, item_count: count });
            const shareUrl = `${window.location.origin}/c/${data.id}`;
            const message = encodeURIComponent(
              `\u{1F6D2} Olha o que separei no BomFilho!\n` +
              `${items.length} itens \u00B7 R$ ${total.toFixed(2).replace('.', ',')}\n\n` +
              `\u{1F449} ${shareUrl}`
            );
            window.open(`https://wa.me/?text=${message}`, '_blank');
          } catch {
            // silently fail
          } finally {
            setSharing(false);
          }
        }}
        style={{
          width: '100%', marginTop: 6, padding: 11, borderRadius: 12,
          background: 'rgba(255,255,255,0.07)', border: `1px solid ${colors.border}`,
          color: colors.white, fontWeight: 700, fontSize: 12,
          cursor: 'pointer', fontFamily: fonts.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: sharing ? 0.6 : 1,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.216l-.256-.154-2.892.86.86-2.892-.154-.256A8 8 0 1112 20z"/>
        </svg>
        {sharing ? 'Gerando link...' : 'Compartilhar via WhatsApp'}
      </button>
    </div>
  );
}

/* ===== STEP 2: ENTREGA ===== */
function DeliveryStep({ delivery, setDelivery, onNext, onBack }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState('');

  const options = [
    { id: 'loja', label: 'Retirada na loja', desc: 'Gratis', icon: 'store' },
    { id: 'bike', label: 'Entrega bike', desc: 'R$ 5,00', icon: 'truck' },
  ];

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 700, color: colors.white, marginBottom: 10, fontFamily: fonts.text }}>
        Forma de recebimento
      </p>
      {options.map(o => {
        const selected = delivery === o.id;
        return (
          <button key={o.id} onClick={() => setDelivery(o.id)} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: 12,
            width: '100%', marginBottom: 6, borderRadius: 12, cursor: 'pointer',
            background: selected ? colors.goldBg : colors.card,
            border: `1px solid ${selected ? colors.goldBorder : colors.border}`,
            fontFamily: fonts.text, textAlign: 'left',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: selected ? 'rgba(226,184,74,0.2)' : colors.card,
              border: `1px solid ${selected ? colors.goldBorder : colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={o.icon} size={15} color={selected ? colors.gold : colors.textSecondary} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: selected ? colors.gold : colors.white, margin: 0 }}>{o.label}</p>
              <p style={{ fontSize: 9, color: colors.textMuted, margin: '1px 0 0' }}>{o.desc}</p>
            </div>
            <div style={{
              width: 15, height: 15, borderRadius: '50%',
              border: `2px solid ${selected ? colors.gold : colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: colors.gold }} />}
            </div>
          </button>
        );
      })}

      {/* Horário de entrega/retirada */}
      <p style={{ fontSize: 13, fontWeight: 700, color: colors.white, margin: '14px 0 8px', fontFamily: fonts.text }}>
        Quando quer {delivery === 'loja' ? 'retirar' : 'receber'}?
      </p>
      <DayPicker selected={selectedDate} onSelect={setSelectedDate} />
      <DeliverySlots selected={selectedSlot} onSelect={setSelectedSlot} />

      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button onClick={onBack} style={{
          flex: 1, padding: 12, background: colors.card,
          border: `1px solid ${colors.border}`, borderRadius: 12,
          color: colors.white, fontWeight: 700, fontSize: 12,
          cursor: 'pointer', fontFamily: fonts.text,
        }}>Voltar</button>
        <button onClick={onNext} disabled={!selectedSlot} style={{
          flex: 2, padding: 12,
          background: selectedSlot ? colors.gold : 'rgba(226,184,74,0.3)',
          border: 'none', borderRadius: 12, color: colors.bgDeep,
          fontWeight: 800, fontSize: 12,
          cursor: selectedSlot ? 'pointer' : 'default',
          fontFamily: fonts.text, opacity: selectedSlot ? 1 : 0.5,
        }}>Enviar pedido</button>
      </div>
    </div>
  );
}

/* ===== STEP 3: VERIFICAÇÃO / ESPERA ===== */
// status: "waiting" | "accepted" | "issues"
// issues: array de product IDs que estão sem estoque
function WaitingStep({ status, issues = [], cart, products, removeItem, onNext }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    if (status === 'waiting') {
      const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
      return () => clearInterval(iv);
    }
  }, [status]);

  // Estado: Aguardando
  if (status === 'waiting') return (
    <div style={{ textAlign: 'center', padding: '28px 0' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: colors.goldBg, border: `2px solid ${colors.goldBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 12px', animation: 'spin 2s linear infinite',
      }}>
        <Icon name="loader" size={22} color={colors.gold} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 800, color: colors.white, margin: 0 }}>Verificando pedido{dots}</p>
      <p style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>Conferindo disponibilidade</p>
    </div>
  );

  // Estado: Aceito
  if (status === 'accepted') return (
    <div style={{ textAlign: 'center', padding: '28px 0' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: colors.successBg, border: '2px solid rgba(90,228,167,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 12px',
      }}>
        <Icon name="check" size={22} color={colors.success} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 800, color: colors.white, margin: 0 }}>Pedido aceito!</p>
      <p style={{ fontSize: 11, color: colors.textSecondary, margin: '4px 0 14px' }}>Todos os produtos disponiveis.</p>
      <button onClick={onNext} style={{
        width: '100%', padding: 13, background: colors.gold, border: 'none',
        borderRadius: 12, color: colors.bgDeep, fontWeight: 800, fontSize: 13,
        cursor: 'pointer', fontFamily: fonts.text,
      }}>Ir para pagamento</button>
    </div>
  );

  // Estado: Itens com problema
  if (status === 'issues') {
    const allResolved = !issues.some(id => cart[id]);
    return (
      <div>
        <div style={{
          background: colors.warnBg, border: `1px solid ${colors.warnBorder}`,
          borderRadius: 10, padding: '9px 11px', marginBottom: 12,
          display: 'flex', gap: 6, alignItems: 'flex-start',
        }}>
          <Icon name="alert" size={14} color={colors.warn} />
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: colors.warn, margin: 0 }}>Itens sem estoque</p>
            <p style={{ fontSize: 9, color: 'rgba(255,183,77,0.7)', margin: '2px 0 0' }}>Remova ou troque pelo WhatsApp.</p>
          </div>
        </div>

        {Object.entries(cart).map(([id, qty]) => {
          const product = products.find(p => p.id === Number(id));
          if (!product) return null;
          const hasIssue = issues.includes(Number(id));
          return (
            <div key={id} style={{
              padding: 9, marginBottom: 5, borderRadius: 9,
              background: hasIssue ? colors.warnBg : colors.card,
              border: `1px solid ${hasIssue ? colors.warnBorder : colors.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: colors.white, margin: 0, fontFamily: fonts.text }}>
                  {formatProductName(product.name)}
                </p>
                <span style={{
                  fontFamily: fonts.number, fontWeight: 800, fontSize: 11,
                  color: hasIssue ? colors.warn : colors.gold,
                }}>
                  {formatPrice(product.price * qty)}
                </span>
              </div>
              {hasIssue && (
                <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                  <button onClick={() => removeItem(Number(id))} style={{
                    flex: 1, padding: 5, borderRadius: 5,
                    background: colors.errorBg, border: `1px solid ${colors.errorBorder}`,
                    fontSize: 9, color: colors.error, fontWeight: 700,
                    cursor: 'pointer', fontFamily: fonts.text,
                  }}>Remover</button>
                  <a href="https://wa.me/5591999652790" target="_blank" rel="noopener noreferrer" style={{
                    flex: 1, padding: 5, borderRadius: 5,
                    background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.22)',
                    fontSize: 9, color: colors.whatsapp, fontWeight: 700,
                    textDecoration: 'none', textAlign: 'center', fontFamily: fonts.text,
                  }}>WhatsApp</a>
                </div>
              )}
            </div>
          );
        })}

        {allResolved && (
          <button onClick={onNext} style={{
            width: '100%', marginTop: 10, padding: 13,
            background: colors.gold, border: 'none', borderRadius: 12,
            color: colors.bgDeep, fontWeight: 800, fontSize: 13,
            cursor: 'pointer', fontFamily: fonts.text,
          }}>Continuar pagamento</button>
        )}
      </div>
    );
  }

  return null;
}

/* ===== STEP 4: PAGAMENTO ===== */
function PaymentStep({ payment, setPayment, total, onNext, onBack }) {
  const methods = [
    { id: 'pix', label: 'PIX', icon: 'zap', badge: 'Recomendado' },
    { id: 'credit', label: 'Cartao credito', icon: 'creditCard' },
    { id: 'debit', label: 'Cartao debito', icon: 'creditCard' },
  ];

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 700, color: colors.white, marginBottom: 10, fontFamily: fonts.text }}>
        Forma de pagamento
      </p>
      {methods.map(m => {
        const selected = payment === m.id;
        return (
          <button key={m.id} onClick={() => setPayment(m.id)} style={{
            display: 'flex', alignItems: 'center', gap: 9, padding: 12,
            width: '100%', marginBottom: 6, borderRadius: 12, cursor: 'pointer',
            background: selected ? colors.goldBg : colors.card,
            border: `1px solid ${selected ? colors.goldBorder : colors.border}`,
            fontFamily: fonts.text, textAlign: 'left',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: selected ? 'rgba(226,184,74,0.2)' : colors.card,
              border: `1px solid ${selected ? colors.goldBorder : colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={m.icon} size={15} color={selected ? colors.gold : colors.textSecondary} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: selected ? colors.gold : colors.white, margin: 0 }}>{m.label}</p>
                {m.badge && <span style={{
                  fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                  background: colors.successBg, color: colors.success,
                }}>{m.badge}</span>}
              </div>
            </div>
            <div style={{
              width: 15, height: 15, borderRadius: '50%',
              border: `2px solid ${selected ? colors.gold : colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: colors.gold }} />}
            </div>
          </button>
        );
      })}

      <div style={{
        background: colors.card, border: `1px solid ${colors.border}`,
        borderRadius: 10, padding: 9, margin: '8px 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: colors.textMuted, fontSize: 10 }}>Total</span>
          <span style={{ color: colors.gold, fontFamily: fonts.number, fontWeight: 900, fontSize: 17 }}>{formatPrice(total)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onBack} style={{
          flex: 1, padding: 12, background: colors.card,
          border: `1px solid ${colors.border}`, borderRadius: 12,
          color: colors.white, fontWeight: 700, fontSize: 12,
          cursor: 'pointer', fontFamily: fonts.text,
        }}>Voltar</button>
        <button onClick={onNext} disabled={!payment} style={{
          flex: 2, padding: 12, background: payment ? colors.gold : 'rgba(226,184,74,0.3)',
          border: 'none', borderRadius: 12, color: colors.bgDeep,
          fontWeight: 800, fontSize: 12, cursor: payment ? 'pointer' : 'default',
          fontFamily: fonts.text, opacity: payment ? 1 : 0.5,
        }}>Confirmar pedido</button>
      </div>
    </div>
  );
}

/* ===== STEP 5: CONFIRMADO ===== */
function ConfirmedStep({ orderId, onGoHome, cart = {}, products = [], total = 0, payment = 'pix', delivery = 'loja' }) {
  const { saveList, count: savedCount } = useSavedLists();
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [listSaved, setListSaved] = useState(false);

  const orderItems = Object.entries(cart).map(([id, qty]) => {
    const p = products.find(x => x.id === Number(id));
    return p ? { id: p.id, name: p.name, quantity: qty, price: p.price, image_url: p.image_url } : null;
  }).filter(Boolean);

  const labelPagamento = payment === 'pix' ? 'PIX' : payment === 'credit' ? 'Crédito' : 'Débito';
  const labelEntrega = delivery === 'loja' ? 'Retirada' : 'Entrega';

  return (
    <div style={{ padding: '28px 0' }}>
      {/* Header sucesso */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: colors.successBg, border: '2px solid rgba(90,228,167,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px',
        }}>
          <Icon name="check" size={24} color={colors.success} />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 900, color: colors.white, margin: 0, fontFamily: fonts.text }}>
          Pedido confirmado!
        </h2>
        <p style={{ fontSize: 12, color: colors.textSecondary, margin: '4px 0 0' }}>
          Pedido <span style={{ fontFamily: fonts.number, fontWeight: 700, color: colors.gold }}>#{orderId}</span> · {labelPagamento} · {labelEntrega}
        </p>
        <p style={{ fontFamily: fonts.number, fontWeight: 900, fontSize: 20, color: colors.gold, margin: '8px 0 16px' }}>
          {formatPrice(total)}
        </p>
      </div>

      {/* Itens do pedido */}
      {orderItems.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: 14, marginBottom: 14,
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10,
          }}>
            {orderItems.length} ite{orderItems.length === 1 ? 'm' : 'ns'} no pedido
          </p>
          {orderItems.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                {item.image_url ? (
                  <img src={item.image_url} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 16, width: 28, textAlign: 'center' }}>{'\u{1F4E6}'}</span>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatProductName(item.name)}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                    {item.quantity}x · {formatPrice(item.price)}
                  </p>
                </div>
              </div>
              <span style={{ fontFamily: fonts.number, fontWeight: 700, fontSize: 13, color: colors.gold, flexShrink: 0 }}>
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CTA Salvar lista */}
      {!listSaved ? (
        <SaveCartCTA onSave={() => setShowSaveModal(true)} savedCount={savedCount} />
      ) : (
        <div style={{
          textAlign: 'center', padding: 12, borderRadius: 12,
          background: 'rgba(90,228,167,0.12)', border: '1px solid rgba(90,228,167,0.2)',
          color: '#5AE4A7', fontWeight: 700, fontSize: '0.84rem', marginBottom: 12,
        }}>
          {'\u2713'} Lista salva com sucesso
        </div>
      )}

      {/* Ver listas salvas */}
      {savedCount > 0 && (
        <button onClick={() => {}} style={{
          width: '100%', padding: 12, borderRadius: 12,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          fontFamily: fonts.text, marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {'\u2630'} Ver listas salvas ({savedCount})
        </button>
      )}

      {/* Voltar */}
      <button onClick={onGoHome} style={{
        width: '100%', padding: 13, background: 'transparent',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
        color: colors.white, fontWeight: 700, fontSize: 13,
        cursor: 'pointer', fontFamily: fonts.text,
      }}>Voltar ao início</button>

      {/* Modal salvar */}
      <SaveCartModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        cartItems={orderItems}
        onSave={(name) => {
          saveList(name, orderItems);
          setShowSaveModal(false);
          setListSaved(true);
        }}
      />
    </div>
  );
}

/* ===== CHECKOUT PRINCIPAL ===== */
export default function Checkout({ cart, products, updateQty, removeItem, onGoHome }) {
  const [step, setStep] = useState(0);
  const [delivery, setDelivery] = useState('loja');
  const [payment, setPayment] = useState('pix');
  const [orderStatus, setOrderStatus] = useState('waiting'); // waiting | accepted | issues
  const [stockIssues, setStockIssues] = useState([]);

  const total = Object.entries(cart).reduce((s, [id, qty]) => {
    const p = products.find(x => x.id === Number(id));
    return s + (p ? p.price * qty : 0);
  }, 0);

  const titles = ['Carrinho', 'Entrega', 'Verificacao', 'Pagamento', 'Confirmado'];

  // TODO: Substituir por polling real da API
  // GET /api/orders/:id/status → { status, issues: [productId, ...] }
  useEffect(() => {
    if (step === 2) {
      setOrderStatus('waiting');
      setStockIssues([]);

      // SIMULAÇÃO: após 3s verifica estoque
      // Na implementação real, substituir por:
      // const interval = setInterval(async () => {
      //   const res = await fetch(`/api/orders/${orderId}/status`);
      //   const data = await res.json();
      //   if (data.status !== 'pending') {
      //     setOrderStatus(data.status);
      //     setStockIssues(data.issues || []);
      //     clearInterval(interval);
      //   }
      // }, 5000);
      const timer = setTimeout(() => {
        const bigQtyItems = Object.entries(cart)
          .filter(([, qty]) => qty > 10)
          .map(([id]) => Number(id));

        if (bigQtyItems.length > 0) {
          setOrderStatus('issues');
          setStockIssues(bigQtyItems);
        } else {
          setOrderStatus('accepted');
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [step]);

  const next = () => setStep(s => Math.min(s + 1, 4));
  const back = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div>
      {/* Header do checkout */}
      <div style={{ padding: '10px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {step === 0 ? (
          <button onClick={onGoHome} style={{
            width: 34, height: 34, borderRadius: 10,
            background: colors.card, border: `1px solid ${colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }} aria-label="Fechar carrinho">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        ) : step < 4 ? (
          <button onClick={back} style={{
            width: 34, height: 34, borderRadius: 10,
            background: colors.card, border: `1px solid ${colors.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }} aria-label="Voltar">
            <Icon name="back" size={14} color={colors.textSecondary} />
          </button>
        ) : <div style={{ width: 34 }} />}
        <h1 style={{ fontSize: 15, fontWeight: 800, color: colors.white, margin: 0, fontFamily: fonts.text }}>
          {titles[step]}
        </h1>
        <div style={{ width: 34 }} />
      </div>

      {/* Progress bar */}
      {step < 4 && <div style={{ padding: '0 16px' }}><ProgressBar step={step} /></div>}

      {/* Conteúdo da etapa */}
      <div style={{ padding: '0 16px 30px' }}>
        {step === 0 && <CartStep cart={cart} products={products} updateQty={updateQty} onNext={next} />}
        {step === 1 && <DeliveryStep delivery={delivery} setDelivery={setDelivery} onNext={next} onBack={back} />}
        {step === 2 && <WaitingStep status={orderStatus} issues={stockIssues} cart={cart} products={products} removeItem={removeItem} onNext={next} />}
        {step === 3 && <PaymentStep payment={payment} setPayment={setPayment} total={total} onNext={next} onBack={back} />}
        {step === 4 && <ConfirmedStep orderId={19} onGoHome={onGoHome} cart={cart} products={products} total={total} payment={payment} delivery={delivery} />}
      </div>
    </div>
  );
}
