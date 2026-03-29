import React from 'react';
import { colors, fonts, formatPrice } from '../../theme';

const CAT_EMOJI = {
  'bebidas': '\u{1F964}', 'mercearia': '\u{1F6D2}', 'hortifruti': '\u{1F96C}',
  'frios': '\u{1F9CA}', 'higiene': '\u{1F9F4}', 'limpeza': '\u{1F9F9}',
};

function getEmoji(cat) {
  return CAT_EMOJI[(cat || '').toLowerCase()] || '\u{1F4E6}';
}

function HighlightText({ text, highlight }) {
  if (!highlight?.trim()) return <>{text}</>;
  const nt = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nh = highlight.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const idx = nt.indexOf(nh);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: 'rgba(226,184,74,0.25)', color: colors.gold, borderRadius: 2, padding: '0 1px', fontWeight: 700 }}>
        {text.slice(idx, idx + highlight.length)}
      </span>
      {text.slice(idx + highlight.length)}
    </>
  );
}

export default function SearchDropdown({ sections, query, onSelectProduct, onSelectCategory, onSelectHistory, onRemoveHistory }) {
  if (!sections?.length) return null;

  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
      background: '#132E27', border: `1px solid ${colors.border}`, borderRadius: 16,
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
      maxHeight: 'min(400px, 60vh)', overflowY: 'auto',
      animation: 'searchDropIn 0.15s ease-out',
    }}>
      <style>{`@keyframes searchDropIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {sections.map((section, si) => {
        if (section.type === 'empty') {
          return (
            <div key="empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, opacity: 0.5, marginBottom: 6 }}>{'\u{1F50D}'}</div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 3px', fontFamily: fonts.text }}>
                Nenhum resultado para "{section.query}"
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, fontFamily: fonts.text }}>
                Tente outro nome ou categoria
              </p>
            </div>
          );
        }

        return (
          <div key={si} style={{ padding: '6px 0', borderTop: si > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <div style={{
              padding: '6px 16px 3px', fontSize: 9, fontWeight: 700,
              color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
              letterSpacing: '0.08em', fontFamily: fonts.text,
            }}>{section.label}</div>

            {section.items.map((item, ii) => {
              if (item.type === 'history') {
                return (
                  <button key={`h${ii}`} onClick={() => onSelectHistory(item.text)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: fonts.text }}>{item.text}</span>
                    {item.removable && (
                      <span onClick={(e) => { e.stopPropagation(); onRemoveHistory(item.text); }} style={{
                        color: 'rgba(255,255,255,0.3)', fontSize: 10, cursor: 'pointer', padding: '2px 4px',
                      }}>x</span>
                    )}
                  </button>
                );
              }

              if (item.type === 'category') {
                return (
                  <button key={`c${ii}`} onClick={() => onSelectCategory(item.text)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500, fontFamily: fonts.text }}>
                      {item.text}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: fonts.text }}>
                      {item.count} produtos
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
                  </button>
                );
              }

              if (item.type === 'product') {
                const p = item.product;
                const name = p._dn || p.name || p.nome || '';
                const img = p.image_url || p.imagem || '';
                const cat = p.category || p.categoria || '';
                const price = p.price || p.preco || 0;
                return (
                  <button key={`p${p.id || ii}`} onClick={() => onSelectProduct(p)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px',
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)',
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {img ? (
                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      ) : (
                        <span style={{ fontSize: 14 }}>{getEmoji(cat)}</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: fonts.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        <HighlightText text={name} highlight={query} />
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: fonts.text }}>{cat}</div>
                    </div>
                    <span style={{ fontFamily: fonts.number, fontWeight: 700, fontSize: 13, color: colors.gold, flexShrink: 0 }}>
                      {formatPrice(price)}
                    </span>
                  </button>
                );
              }
              return null;
            })}
          </div>
        );
      })}
    </div>
  );
}
