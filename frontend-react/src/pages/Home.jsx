import React from 'react';
// pages/Home.jsx — Tela inicial do BomFilho
// Props: cart (objeto {id:qty}), onAdd(id), onRemove(id), onGoProducts(), onGoCategory(catId), products (array)
// products vem da API: [{id, name, description, price, oldPrice?, category, tag?, image_url?}]

import { colors, fonts, formatPrice } from '../theme';
import Icon from '../components/Icon';
import ProductCard from '../components/ProductCard';

const promos = [
  { title: 'PRIMEIRA COMPRA', subtitle: '20% OFF com Pix', code: 'BOM20', dark: true },
  { title: 'FRETE GRATIS', subtitle: 'Acima de R$80', code: 'FRETEBOM', dark: false },
  { title: 'HORTIFRUTI', subtitle: 'Ate 30% OFF', code: 'HORTA30', dark: true },
];

const categoryList = [
  { id: 'bebidas', name: 'Bebidas', icon: 'wine' },
  { id: 'mercearia', name: 'Mercearia', icon: 'basket' },
  { id: 'hortifruti', name: 'Hortifruti', icon: 'leaf' },
  { id: 'higiene', name: 'Higiene', icon: 'drop' },
  { id: 'limpeza', name: 'Limpeza', icon: 'sparkle' },
];

export default function Home({ cart = {}, onAdd, onRemove, onGoProducts, onGoCategory, products = [] }) {
  const ofertas = products.filter(p => p.tag === 'Oferta' || p.oldPrice).slice(0, 8);
  const recentes = products.slice(0, 4); // TODO: substituir por produtos recentes do localStorage

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Saudação */}
      <div style={{ padding: '12px 0 4px' }}>
        <p style={{ fontSize: 11, color: colors.textMuted, margin: '0 0 2px', fontFamily: fonts.text }}>
          Seu supermercado online
        </p>
        <h1 style={{
          fontSize: 22, fontWeight: 900, margin: 0, lineHeight: 1.15,
          color: colors.white, fontFamily: fonts.text,
        }}>
          O que voce precisa <span style={{ color: colors.gold }}>hoje?</span>
        </h1>
      </div>

      {/* Busca */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 12,
        background: colors.card, borderRadius: 11,
        padding: '2px 3px 2px 11px', border: `1px solid ${colors.border}`,
      }}>
        <Icon name="search" size={14} color={colors.textMuted} />
        <input
          placeholder="Buscar: arroz, cafe, leite..."
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 12, color: colors.white, padding: '8px 0', fontFamily: fonts.text,
          }}
        />
        <button
          onClick={onGoProducts}
          style={{
            background: colors.gold, border: 'none', borderRadius: 8,
            color: colors.bgDeep, padding: '8px 13px', cursor: 'pointer',
            fontWeight: 800, fontSize: 11, fontFamily: fonts.text,
          }}
        >
          Buscar
        </button>
      </div>

      {/* Banners de promoção */}
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', marginTop: 12 }}>
        {promos.map((p, i) => (
          <div key={i} style={{
            background: p.dark
              ? `linear-gradient(135deg, ${colors.bgDeep}, ${colors.bgDark})`
              : `linear-gradient(135deg, ${colors.goldBg}, rgba(226,184,74,0.04))`,
            borderRadius: 12, padding: '13px 15px', minWidth: 175, flex: '0 0 auto',
            border: `1px solid ${p.dark ? colors.border : colors.goldBorder}`,
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
          }}>
            <div style={{
              position: 'absolute', top: -14, right: -14,
              width: 50, height: 50, borderRadius: '50%',
              background: 'rgba(226,184,74,0.06)',
            }} />
            <p style={{
              fontSize: 7, fontWeight: 700, letterSpacing: '0.1em',
              color: colors.gold, margin: '0 0 2px', fontFamily: fonts.text,
            }}>
              {p.title}
            </p>
            <p style={{
              fontSize: 13, fontWeight: 800, color: colors.white,
              margin: '0 0 7px', lineHeight: 1.2, fontFamily: fonts.text,
            }}>
              {p.subtitle}
            </p>
            <span style={{
              background: colors.goldBg, border: `1px solid ${colors.goldBorder}`,
              padding: '2px 7px', borderRadius: 5,
              fontSize: 8, fontWeight: 700, color: colors.gold, fontFamily: fonts.number,
            }}>
              {p.code}
            </span>
          </div>
        ))}
      </div>

      {/* Categorias */}
      <div style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, color: colors.white, marginBottom: 8, fontFamily: fonts.text }}>
          Categorias
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
          {categoryList.map(cat => (
            <button key={cat.id} onClick={() => onGoCategory(cat.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 3px', borderRadius: 10,
              background: colors.card, border: `1px solid ${colors.border}`,
              cursor: 'pointer', fontFamily: fonts.text,
            }}>
              <Icon name={cat.icon} size={20} color={colors.textSecondary} strokeWidth={1.5} />
              <span style={{ fontSize: 9, fontWeight: 700, color: colors.textSecondary }}>
                {cat.name}
              </span>
            </button>
          ))}
          <button onClick={onGoProducts} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '10px 3px', borderRadius: 10,
            background: colors.goldBg, border: `1px solid ${colors.goldBorder}`,
            cursor: 'pointer', fontFamily: fonts.text,
          }}>
            <Icon name="grid" size={20} color={colors.gold} strokeWidth={1.5} />
            <span style={{ fontSize: 9, fontWeight: 700, color: colors.gold }}>Ver tudo</span>
          </button>
        </div>
      </div>

      {/* Ofertas do dia */}
      {ofertas.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{
              fontSize: 13, fontWeight: 800, color: colors.white,
              display: 'flex', alignItems: 'center', gap: 4, fontFamily: fonts.text,
            }}>
              <Icon name="flame" size={13} color={colors.gold} fill={colors.gold} strokeWidth={0} />
              Ofertas do dia
            </h2>
            <button onClick={() => onGoCategory('ofertas')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.gold, fontWeight: 700, fontSize: 10, fontFamily: fonts.text,
            }}>
              Ver todas
            </button>
          </div>
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto' }}>
            {ofertas.map(p => (
              <div key={p.id} style={{ minWidth: 135, maxWidth: 135, flex: '0 0 auto' }}>
                <ProductCard product={p} qty={cart[p.id] || 0} onAdd={onAdd} onRemove={onRemove} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Populares / Continue de onde parou */}
      <div style={{ marginTop: 16, marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, color: colors.white, marginBottom: 8, fontFamily: fonts.text }}>
          Populares
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
          {recentes.map(p => (
            <ProductCard key={p.id} product={p} qty={cart[p.id] || 0} onAdd={onAdd} onRemove={onRemove} compact />
          ))}
        </div>
      </div>

      {/* Rodapé */}
      <div style={{
        marginTop: 14, marginBottom: 8, padding: 14,
        background: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: colors.gold,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="cart" size={12} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13, color: colors.white, fontFamily: fonts.text }}>
              Bom<span style={{ color: colors.gold }}>Filho</span>
            </div>
            <div style={{ fontSize: 8, color: colors.textMuted, fontFamily: fonts.text }}>
              Supermercado de confianca
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: colors.textSecondary }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="message" size={10} color={colors.textSecondary} /> (91) 99965-2790
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="phone" size={10} color={colors.textSecondary} /> (91) 3721-9780
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="clock" size={10} color={colors.textSecondary} /> Seg-Sab 7h30-19h30 | Dom 8h-12h30
          </div>
        </div>
      </div>
    </div>
  );
}
