import React from 'react';

export default function SaveCartCTA({ onSave, savedCount = 0 }) {
  return (
    <div style={{
      background: 'rgba(226,184,74,0.15)',
      border: '1px solid rgba(226,184,74,0.3)',
      borderRadius: 16, padding: 18, marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: '#E2B84A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#174A40', flexShrink: 0, fontSize: 16,
        }}>
          <span aria-hidden="true" role="img">&#128190;</span>
        </div>
        <div>
          <p style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fff', margin: 0 }}>
            Salvar esta lista?
          </p>
          <p style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
            Recompre tudo com 1 toque na próxima vez
          </p>
        </div>
      </div>
      <button onClick={onSave} style={{
        width: '100%', padding: '12px 0', borderRadius: 12,
        background: '#E2B84A', border: 'none', color: '#174A40',
        fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0 4px 12px rgba(226,184,74,0.4)',
      }}>
        <span aria-hidden="true" role="img">&#128190;</span> Salvar lista de compras
      </button>
      {savedCount > 0 && (
        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
          Você tem {savedCount} lista{savedCount > 1 ? 's' : ''} salva{savedCount > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
