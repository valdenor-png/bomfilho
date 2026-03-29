import React from 'react';
import { colors, fonts } from '../theme';

const SLOTS = [
  { id: '09-11', label: '09:00 - 11:00' },
  { id: '11-13', label: '11:00 - 13:00' },
  { id: '14-16', label: '14:00 - 16:00' },
  { id: '16-18', label: '16:00 - 18:00' },
  { id: '18-20', label: '18:00 - 20:00' },
];

const MAX_PER_SLOT = 5;

export default function DeliverySlots({ selected, onSelect, availability = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {SLOTS.map(slot => {
        const remaining = availability[slot.id] ?? MAX_PER_SLOT;
        const isFull = remaining <= 0;
        const isLow = remaining > 0 && remaining <= 2;
        const isSelected = selected === slot.id;

        return (
          <button
            key={slot.id}
            onClick={() => !isFull && onSelect(slot.id)}
            disabled={isFull}
            style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: 10,
              background: isSelected ? colors.goldBg : isFull ? 'rgba(255,255,255,0.02)' : colors.card,
              border: `1px solid ${isSelected ? colors.goldBorder : isFull ? 'rgba(255,255,255,0.04)' : colors.border}`,
              cursor: isFull ? 'default' : 'pointer',
              opacity: isFull ? 0.4 : 1,
              fontFamily: fonts.text, width: '100%',
            }}
          >
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: isSelected ? colors.gold : '#fff',
              fontFamily: fonts.number,
            }}>
              {slot.label}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: isFull ? colors.error : isLow ? colors.warn : 'rgba(255,255,255,0.4)',
            }}>
              {isFull ? 'Esgotado' : `${remaining} vaga${remaining > 1 ? 's' : ''}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DayPicker({ selected, onSelect }) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const currentHour = today.getHours();
  const days = [];

  if (currentHour < 18) {
    days.push({
      date: fmt(today),
      label: 'Hoje',
      sub: today.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }),
    });
  }
  days.push({
    date: fmt(tomorrow),
    label: 'Amanha',
    sub: tomorrow.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }),
  });

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {days.map(day => {
        const active = selected === day.date;
        return (
          <button key={day.date} onClick={() => onSelect(day.date)} style={{
            flex: 1, padding: '10px 12px', borderRadius: 10,
            background: active ? colors.gold : colors.card,
            border: active ? 'none' : `1px solid ${colors.border}`,
            color: active ? colors.bgDeep : '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            fontFamily: fonts.text, textAlign: 'center',
          }}>
            <div>{day.label}</div>
            <div style={{
              fontSize: 10, fontWeight: 500,
              color: active ? colors.bgDeep : 'rgba(255,255,255,0.4)',
              marginTop: 2,
            }}>{day.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

function fmt(d) {
  return d.toISOString().split('T')[0];
}
