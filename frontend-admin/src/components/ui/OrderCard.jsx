import React from 'react';
import { colors, fonts, radius, getStatusStyle } from '../../styles/tokens';
import Badge from './Badge';

// Order card for Historico de Pedidos
// <OrderCard pedido={p} onAction={...} onExpand={...} expanded={...} />

function ProgressBar({ steps, current }) {
  const idx = steps.findIndex(s => s.key === current);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 0' }}>
      {steps.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
            {i > 0 && (
              <div style={{
                position: 'absolute', top: 5, right: '50%', left: '-50%', height: 3,
                background: done ? colors.green : colors.borderDim,
                borderRadius: 2, zIndex: 0,
              }} />
            )}
            <div style={{
              width: 10, height: 10, borderRadius: '50%', position: 'relative', zIndex: 1,
              background: done ? colors.green : active ? colors.gold : colors.borderDim,
              border: `2px solid ${done ? colors.green : active ? colors.gold : colors.borderDim}`,
              boxShadow: active ? `0 0 8px rgba(226,184,74,0.4)` : 'none',
            }} />
            <span style={{
              fontSize: 8, fontWeight: 600, textAlign: 'center',
              color: done ? colors.green : active ? colors.gold : colors.dim,
              fontFamily: fonts.text,
            }}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderCard({ id, status, clienteNome, clienteTel, valor, itensTexto, dataCriacao, tipoPagamento, tipoEntrega, badges = [], isCancelled, children, borderColor, style }) {
  const statusInfo = getStatusStyle(status);
  const leftBorderColor = borderColor || (isCancelled ? colors.red : statusInfo.color);

  const initials = (clienteNome || '?').split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2);

  const isRetirada = String(tipoEntrega || '').toLowerCase() === 'retirada';
  const progressSteps = isRetirada
    ? [{ key: 'preparo', label: 'PREPARO' }, { key: 'retirada', label: 'RETIRADA' }, { key: 'concluido', label: 'CONCLUIDO' }]
    : [{ key: 'preparo', label: 'PREPARO' }, { key: 'entrega', label: 'ENTREGA' }, { key: 'concluido', label: 'CONCLUIDO' }];

  const statusToStep = {
    pago: 'preparo', preparando: 'preparo',
    pronto_para_retirada: 'retirada', enviado: 'entrega',
    entregue: 'concluido', retirado: 'concluido',
  };
  const currentStep = statusToStep[status] || 'preparo';

  return (
    <article style={{
      background: colors.bgCard,
      border: `1px solid ${colors.border}`,
      borderLeft: `4px solid ${leftBorderColor}`,
      borderRadius: radius.lg,
      padding: 14,
      opacity: isCancelled ? 0.7 : 1,
      transition: 'transform 0.15s, box-shadow 0.15s',
      ...style,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: fonts.numbers, color: colors.gold }}>
            #{id}
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            <Badge status={status} />
            {badges.map((b, i) => <Badge key={i} tone={b.tone} label={b.label} />)}
          </div>
        </div>
        <span style={{ fontSize: 10, color: colors.dim, fontFamily: fonts.numbers }}>{dataCriacao}</span>
      </div>

      {/* Client + Value */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: radius.md,
          background: `linear-gradient(135deg, ${colors.teal}, ${colors.tealLight})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13, fontFamily: fonts.text, color: colors.white,
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: colors.white }}>{clienteNome || '—'}</p>
          <p style={{ fontSize: 10, color: colors.dim, margin: 0 }}>{clienteTel || ''}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: 20, fontWeight: 800, fontFamily: fonts.numbers, color: colors.gold,
            textDecoration: isCancelled ? 'line-through' : 'none',
          }}>
            {valor}
          </span>
          <p style={{ fontSize: 10, color: colors.dim, margin: 0 }}>
            {itensTexto} {tipoPagamento ? `· ${tipoPagamento}` : ''} {tipoEntrega ? `· ${tipoEntrega}` : ''}
          </p>
        </div>
      </div>

      {/* Progress bar (only for non-cancelled) */}
      {!isCancelled && <ProgressBar steps={progressSteps} current={currentStep} />}

      {/* Children = action buttons, expanded details, etc */}
      {children}
    </article>
  );
}
