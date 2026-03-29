import React, { useState } from 'react';
import { colors, fonts } from '../../theme';

const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Toda semana' },
  { value: 'biweekly', label: 'A cada 2 semanas' },
  { value: 'monthly', label: 'Todo mes' },
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function calculateNextReminder(frequency, preferredDay) {
  const now = new Date();
  const result = new Date(now);
  if (frequency === 'monthly') {
    result.setMonth(now.getMonth() + 1);
    result.setDate(Math.min(preferredDay, 28));
  } else {
    const diff = (preferredDay - now.getDay() + 7) % 7;
    result.setDate(now.getDate() + (diff === 0 ? 7 : diff));
    if (frequency === 'biweekly') result.setDate(result.getDate() + 7);
  }
  return result.toISOString().split('T')[0];
}

export default function RecurringSetupModal({ isOpen, onClose, cartItems = [], onSave }) {
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [preferredDay, setPreferredDay] = useState(1);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const nextReminder = calculateNextReminder(frequency, preferredDay);
    const items = cartItems.map(i => ({
      productId: i.id || i.productId,
      name: i.nome || i.name,
      quantity: i.quantidade || i.quantity || 1,
      price: i.preco || i.price,
    }));

    // Save to localStorage for MVP
    const key = 'bomfilho_recurring';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push({
      id: Date.now().toString(36),
      name: name.trim(),
      items,
      frequency,
      preferredDay,
      nextReminder,
      isActive: true,
      timesUsed: 0,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(existing));

    if (onSave) onSave();
    setSaving(false);
    onClose();
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto',
        background: colors.bgDark || '#174A40',
        borderRadius: '20px 20px 0 0', border: `1px solid ${colors.border}`,
        padding: '20px 16px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.white, margin: 0, fontFamily: fonts.text }}>
            Compra Recorrente
          </h3>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.07)', border: `1px solid ${colors.border}`,
            borderRadius: 8, width: 32, height: 32, color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer', fontSize: 14,
          }}>x</button>
        </div>

        {/* Nome */}
        <label style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 600, display: 'block', marginBottom: 4, fontFamily: fonts.text }}>
          Nome da compra
        </label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Agua toda semana"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10, marginBottom: 14,
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${colors.border}`,
            color: colors.white, fontSize: 13, fontFamily: fonts.text, outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* Frequencia */}
        <label style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 600, display: 'block', marginBottom: 6, fontFamily: fonts.text }}>
          Frequencia
        </label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {FREQ_OPTIONS.map(f => (
            <button key={f.value} onClick={() => setFrequency(f.value)} style={{
              flex: 1, padding: '9px 6px', borderRadius: 10,
              background: frequency === f.value ? colors.goldBg : colors.card,
              border: `1px solid ${frequency === f.value ? colors.goldBorder : colors.border}`,
              color: frequency === f.value ? colors.gold : colors.textSecondary,
              fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.text,
            }}>{f.label}</button>
          ))}
        </div>

        {/* Dia */}
        <label style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 600, display: 'block', marginBottom: 6, fontFamily: fonts.text }}>
          {frequency === 'monthly' ? 'Dia do mes' : 'Dia da semana'}
        </label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
          {frequency === 'monthly' ? (
            Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
              <button key={d} onClick={() => setPreferredDay(d)} style={{
                width: 32, height: 32, borderRadius: 8,
                background: preferredDay === d ? colors.gold : colors.card,
                border: preferredDay === d ? 'none' : `1px solid ${colors.border}`,
                color: preferredDay === d ? colors.bgDeep : colors.textSecondary,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>{d}</button>
            ))
          ) : (
            WEEKDAYS.map((d, i) => (
              <button key={i} onClick={() => setPreferredDay(i)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8,
                background: preferredDay === i ? colors.gold : colors.card,
                border: preferredDay === i ? 'none' : `1px solid ${colors.border}`,
                color: preferredDay === i ? colors.bgDeep : colors.textSecondary,
                fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: fonts.text,
              }}>{d}</button>
            ))
          )}
        </div>

        {/* Preview itens */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 10,
          border: `1px solid ${colors.border}`, padding: 10, marginBottom: 14,
        }}>
          <span style={{ fontSize: 10, color: colors.textMuted, fontFamily: fonts.text }}>
            {cartItems.length} itens serao recorrentes
          </span>
          {cartItems.slice(0, 3).map((item, i) => (
            <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: '3px 0', fontFamily: fonts.text }}>
              {item.quantidade || item.quantity || 1}x {item.nome || item.name}
            </div>
          ))}
          {cartItems.length > 3 && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>+{cartItems.length - 3} mais</span>
          )}
        </div>

        {/* Salvar */}
        <button onClick={handleSave} disabled={!name.trim() || saving} style={{
          width: '100%', padding: 14, borderRadius: 12,
          background: colors.gold, border: 'none', color: colors.bgDeep,
          fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: fonts.text,
          opacity: (!name.trim() || saving) ? 0.5 : 1,
        }}>
          {saving ? 'Salvando...' : 'Ativar compra recorrente'}
        </button>
      </div>
    </div>
  );
}
