import React, { useState, useEffect, useRef } from 'react';

const CATEGORY_EMOJIS = {
  bebidas: '\u{1F4A7}', mercearia: '\u{1F6D2}', hortifruti: '\u{1F34C}',
  higiene: '\u{1F9F4}', limpeza: '\u{1F9F9}', frios: '\u{2744}\uFE0F',
};

function getEmoji(name) {
  const n = (name || '').toLowerCase();
  if (/água|suco|refri|cerve|leite/i.test(n)) return '\u{1F4A7}';
  if (/fruta|banana|maçã|laranja|tomate|cebola/i.test(n)) return '\u{1F34C}';
  if (/carne|frango|presunto|linguiça/i.test(n)) return '\u{1F969}';
  if (/sabão|deterg|desinf|álcool/i.test(n)) return '\u{1F9F9}';
  if (/shampoo|creme|papel|sabonete/i.test(n)) return '\u{1F9F4}';
  return '\u{1F4E6}';
}

function getSuggestions(items) {
  const suggestions = ['Compra da semana'];
  if (items.length > 15) suggestions.push('Compra do mês');
  else suggestions.push('Mensal');
  const hasMeat = items.some(i => /carne|picanha|linguiça|costela|frango|churrasco/i.test(i.name || i.nome || ''));
  if (hasMeat) suggestions.push('Churrasco');
  const hasCleaning = items.some(i => /detergente|sabão|desinfetante|limpeza/i.test(i.name || i.nome || ''));
  if (hasCleaning) suggestions.push('Limpeza');
  if (!suggestions.includes('Básico')) suggestions.push('Básico');
  return suggestions.slice(0, 4);
}

export default function SaveCartModal({ isOpen, onClose, cartItems = [], onSave }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);

  const suggestions = getSuggestions(cartItems);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
    if (!isOpen) { setName(''); setSaving(false); setSuccess(false); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    setSaving(true);
    setTimeout(() => {
      onSave(name.trim());
      setSaving(false);
      setSuccess(true);
      setTimeout(() => onClose(), 800);
    }, 300);
  };

  const items = cartItems.map(item => ({
    name: item.name || item.nome || item.title || 'Item',
    qty: item.quantity || item.qty || item.quantidade || 1,
  }));

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 440,
        background: '#174A40',
        borderRadius: '20px 20px 0 0',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: 20, maxHeight: '80vh', overflowY: 'auto',
      }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(90,228,167,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', fontSize: 24, color: '#5AE4A7',
            }}>{'\u2713'}</div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Lista salva!</h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.84rem', margin: 0 }}>
              "{name}" com {items.length} ite{items.length === 1 ? 'm' : 'ns'}
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>Salvar lista</h3>
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, width: 36, height: 36, color: 'rgba(255,255,255,0.7)',
                fontSize: '1.1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{'\u00D7'}</button>
            </div>

            {/* Input */}
            <label style={{
              display: 'block', fontSize: '0.72rem', fontWeight: 700,
              color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
              letterSpacing: '0.06em', marginBottom: 6,
            }}>NOME DA LISTA</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Compra da semana"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: '0.9rem',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                outline: 'none', boxSizing: 'border-box',
              }}
            />

            {/* Suggestions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 16px' }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => setName(s)} style={{
                  padding: '6px 12px', borderRadius: 20,
                  background: name === s ? 'rgba(226,184,74,0.15)' : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${name === s ? 'rgba(226,184,74,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: name === s ? '#E2B84A' : 'rgba(255,255,255,0.7)',
                  fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  {s}
                </button>
              ))}
            </div>

            {/* Preview */}
            <div style={{
              background: 'rgba(255,255,255,0.07)', borderRadius: 12,
              padding: 12, marginBottom: 16, maxHeight: 180, overflowY: 'auto',
            }}>
              <p style={{
                fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
              }}>
                {items.length} ite{items.length === 1 ? 'm' : 'ns'} serão salvos
              </p>
              {items.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 0', fontSize: '0.78rem', color: '#fff',
                }}>
                  <span style={{ width: 22, textAlign: 'center', flexShrink: 0 }}>
                    {getEmoji(item.name)}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.qty}x {item.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Save button */}
            <button onClick={handleSave} disabled={!name.trim() || saving} style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
              fontWeight: 800, fontSize: '0.92rem', cursor: name.trim() ? 'pointer' : 'not-allowed',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              background: name.trim() ? '#E2B84A' : 'rgba(255,255,255,0.07)',
              color: name.trim() ? '#174A40' : 'rgba(255,255,255,0.45)',
            }}>
              {saving ? 'Salvando...' : 'Salvar lista'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
