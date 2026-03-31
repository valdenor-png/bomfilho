import React, { useState } from 'react';
import { ADMIN_COLORS as C, ADMIN_FONTS as F, getStatusType } from './adminTheme';

/* ============================================================
   STATUS BADGE
   <StatusBadge type="warning">Aguardando</StatusBadge>
   <StatusBadge status="Cancelado" /> (auto-detect type)
   ============================================================ */
export function StatusBadge({ type, status, children }) {
  const resolvedType = type || getStatusType(status);
  const label = children || status || '';

  const styles = {
    success: { bg: C.successBg, color: C.success, border: C.successBorder },
    warning: { bg: C.warningBg, color: C.warning, border: C.warningBorder },
    danger:  { bg: C.dangerBg,  color: C.danger,  border: C.dangerBorder },
    neutral: { bg: 'rgba(255,255,255,0.06)', color: C.textSecondary, border: C.border },
    info:    { bg: 'rgba(96,165,250,0.12)', color: '#60A5FA', border: 'rgba(96,165,250,0.2)' },
  };
  const s = styles[resolvedType] || styles.neutral;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
      fontFamily: F.mono,
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: s.color,
      }} />
      {label}
    </span>
  );
}


/* ============================================================
   METRIC CARD
   <MetricCard label="Faturamento" value="R$ 8,24" sub="Total" accent />
   ============================================================ */
export function MetricCard({ label, value, sub, accent = false, icon }) {
  return (
    <div style={{
      background: C.bgCard, borderRadius: 14,
      padding: '18px 20px',
      border: `1px solid ${accent ? C.borderActive : C.border}`,
      position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.2s, transform 0.15s',
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${C.gold}, ${C.tealLight})`,
        }} />
      )}
      <div style={{
        fontSize: 11, color: C.textMuted, fontWeight: 600,
        letterSpacing: 1, textTransform: 'uppercase',
        marginBottom: 8, fontFamily: F.mono,
      }}>
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
        {label}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 700,
        color: accent ? C.gold : C.textPrimary,
        fontFamily: F.mono, lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: 12, color: C.textSecondary, marginTop: 4,
        }}>{sub}</div>
      )}
    </div>
  );
}


/* ============================================================
   PIPELINE CARD (counter cards na Operação ao Vivo)
   <PipelineCard number={1} label="Pagamento" active />
   ============================================================ */
export function PipelineCard({ number = 0, label, active }) {
  const hasItems = active || number > 0;
  return (
    <div style={{
      textAlign: 'center', padding: '14px 8px', borderRadius: 12,
      background: C.bgCard,
      border: `1px solid ${hasItems ? C.borderActive : C.border}`,
    }}>
      <div style={{
        fontFamily: F.mono, fontSize: 26, fontWeight: 700,
        color: hasItems ? C.warning : C.textMuted,
      }}>{number}</div>
      <div style={{
        fontSize: 10, color: C.textMuted, marginTop: 2,
        letterSpacing: 0.5, textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}


/* ============================================================
   PROGRESS BAR (steps do pedido)
   <ProgressBar steps={['Pago','Separando','Preparado','Retirado']} current={1} />
   ============================================================ */
export function ProgressBar({ steps = [], current = 0 }) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        margin: '10px 0 4px',
      }}>
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: i <= current ? C.gold : 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700,
              color: i <= current ? C.bg : C.textMuted,
              fontFamily: F.mono, flexShrink: 0,
              border: i === current ? `2px solid ${C.gold}` : '2px solid transparent',
              boxShadow: i === current ? '0 0 10px rgba(226,184,74,0.3)' : 'none',
            }}>
              {i <= current ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginInline: 3,
                background: i < current
                  ? `linear-gradient(90deg, ${C.gold}, ${C.tealLight})`
                  : 'rgba(255,255,255,0.08)',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {steps.map((s, i) => (
          <span key={i} style={{
            fontSize: 9, color: C.textMuted,
            textAlign: 'center', flex: 1,
          }}>{s}</span>
        ))}
      </div>
    </div>
  );
}


/* ============================================================
   LIVE ORDER CARD (Operação ao Vivo)
   <LiveOrderCard
     id={18} client="Valdenor" value="8,24"
     badges={[{label:'Retirada', type:'neutral'}, {label:'Aguardando', type:'warning'}]}
     steps={['Pago','Separando','Preparado','Retirado']}
     currentStep={0}
     stuck={false}
     stuckTime="62h27min"
     onDetails={() => {}}
   />
   ============================================================ */
export function LiveOrderCard({
  id, client, value, badges = [], steps = [],
  currentStep = 0, stuck = false, stuckTime,
  onDetails,
}) {
  return (
    <div style={{
      background: C.bgCard, borderRadius: 14, padding: 18,
      border: `1px solid ${stuck ? 'rgba(248,113,113,0.2)' : C.border}`,
      marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 6,
      }}>
        <div>
          <span style={{
            fontFamily: F.mono, fontWeight: 700,
            color: stuck ? C.danger : C.gold, fontSize: 16,
          }}>#{id}</span>
          <span style={{
            color: C.textSecondary, fontSize: 13, marginLeft: 10,
          }}>{client}</span>
        </div>
        <span style={{
          fontFamily: F.mono, fontWeight: 700,
          color: C.textPrimary, fontSize: 18,
        }}>R$ {value}</span>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap',
        }}>
          {badges.map((b, i) => (
            <StatusBadge key={i} type={b.type}>{b.label}</StatusBadge>
          ))}
        </div>
      )}

      {/* Stuck alert */}
      {stuck && stuckTime && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 12px', borderRadius: 8,
          background: C.dangerBg, fontSize: 12, color: C.danger,
          marginBottom: 10,
        }}>
          ⏰ Travado há <strong style={{ marginLeft: 4 }}>{stuckTime}</strong>
        </div>
      )}

      {/* Progress */}
      {steps.length > 0 && (
        <ProgressBar steps={steps} current={currentStep} />
      )}

      {/* Details button */}
      <button
        onClick={onDetails}
        style={{
          width: '100%', marginTop: 14, padding: '10px 0',
          borderRadius: 10,
          background: `linear-gradient(135deg, ${C.teal}, ${C.tealLight})`,
          border: 'none', color: C.white,
          fontWeight: 600, fontSize: 13, cursor: 'pointer',
          fontFamily: F.body, letterSpacing: 0.3,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
      >
        🔍 Ver Detalhes
      </button>
    </div>
  );
}


/* ============================================================
   ORDER TABLE ROW
   Usar dentro de uma <AdminTable>
   ============================================================ */
export function OrderRow({ order, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onClick && onClick(order)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 120px 80px 100px',
        alignItems: 'center', padding: '14px 18px', gap: 10,
        borderBottom: `1px solid ${C.border}`,
        background: hovered ? C.bgCardHover : 'transparent',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <span style={{
        fontFamily: F.mono, fontWeight: 700,
        color: C.gold, fontSize: 14,
      }}>#{order.id}</span>
      <div>
        <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 500 }}>
          {order.client}
        </div>
        {order.time && (
          <div style={{ fontSize: 11, color: C.textMuted }}>{order.time}</div>
        )}
      </div>
      <StatusBadge status={order.status} />
      <span style={{
        fontSize: 11, color: C.textMuted, textAlign: 'center',
      }}>{order.payment}</span>
      <span style={{
        fontFamily: F.mono, fontWeight: 600,
        color: C.textPrimary, fontSize: 14, textAlign: 'right',
      }}>R$ {order.value}</span>
    </div>
  );
}


/* ============================================================
   ADMIN TABLE (wrapper com header)
   <AdminTable title="Últimos Pedidos" action="Ver todos →" onAction={...}>
     <OrderRow ... />
   </AdminTable>
   ============================================================ */
export function AdminTable({ title, action, onAction, columns, children }) {
  return (
    <div style={{
      background: C.bgCard, borderRadius: 14,
      border: `1px solid ${C.border}`, overflow: 'hidden',
    }}>
      {/* Header */}
      {(title || action) && (
        <div style={{
          padding: '16px 18px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {title && (
            <span style={{ fontWeight: 700, fontSize: 14, color: C.textPrimary }}>
              {title}
            </span>
          )}
          {action && (
            <span
              onClick={onAction}
              style={{
                fontSize: 12, color: C.gold, cursor: 'pointer',
                fontWeight: 600,
              }}
            >{action}</span>
          )}
        </div>
      )}

      {/* Column headers */}
      {columns && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '60px 1fr 120px 80px 100px',
          padding: '10px 18px', gap: 10,
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10, color: C.textMuted, fontWeight: 700,
          letterSpacing: 1, textTransform: 'uppercase',
          fontFamily: F.mono,
        }}>
          {columns.map((col, i) => (
            <span key={i} style={{
              textAlign: col.align || 'left',
            }}>{col.label}</span>
          ))}
        </div>
      )}

      {/* Content */}
      {children}
    </div>
  );
}


/* ============================================================
   ADMIN ALERT
   <AdminAlert type="danger" icon="🚨" title="Pedido travado" text="..." />
   ============================================================ */
export function AdminAlert({ type = 'danger', icon, title, text, children }) {
  const colors = {
    danger:  { bg: C.dangerBg,  border: 'rgba(248,113,113,0.2)', title: C.danger },
    warning: { bg: C.warningBg, border: 'rgba(251,191,36,0.2)',  title: C.warning },
    success: { bg: C.successBg, border: 'rgba(52,211,153,0.2)',  title: C.success },
  };
  const s = colors[type] || colors.danger;

  return (
    <div style={{
      borderRadius: 12, padding: 16,
      display: 'flex', gap: 12, alignItems: 'flex-start',
      marginBottom: 24,
      background: s.bg, border: `1px solid ${s.border}`,
    }}>
      {icon && <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>}
      <div>
        {title && (
          <div style={{
            fontWeight: 600, fontSize: 13,
            color: s.title, marginBottom: 4,
          }}>{title}</div>
        )}
        {text && (
          <div style={{ fontSize: 12, color: C.textSecondary }}>{text}</div>
        )}
        {children}
      </div>
    </div>
  );
}


/* ============================================================
   ADMIN BUTTONS
   <AdminButton variant="primary">Salvar</AdminButton>
   <AdminButton variant="secondary">Ver Detalhes</AdminButton>
   <AdminButton variant="ghost">Limpar</AdminButton>
   <AdminButton variant="danger">Cancelar</AdminButton>
   ============================================================ */
export function AdminButton({ variant = 'primary', children, fullWidth, ...props }) {
  const variants = {
    primary: {
      background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
      color: C.bg, border: 'none', fontWeight: 700,
    },
    secondary: {
      background: `linear-gradient(135deg, ${C.teal}, ${C.tealLight})`,
      color: '#fff', border: 'none', fontWeight: 600,
    },
    ghost: {
      background: 'transparent',
      color: C.textSecondary,
      border: `1px solid ${C.border}`,
      fontWeight: 500,
    },
    danger: {
      background: C.dangerBg,
      color: C.danger,
      border: `1px solid rgba(248,113,113,0.2)`,
      fontWeight: 600,
    },
  };
  const s = variants[variant] || variants.primary;

  return (
    <button
      {...props}
      style={{
        ...s,
        padding: '10px 24px', borderRadius: 8,
        fontSize: 13, cursor: 'pointer',
        fontFamily: F.body, letterSpacing: 0.3,
        width: fullWidth ? '100%' : 'auto',
        transition: 'opacity 0.15s, transform 0.1s',
        ...props.style,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
    >
      {children}
    </button>
  );
}


/* ============================================================
   ADMIN INPUT / SELECT / TEXTAREA
   <AdminInput label="Nome" placeholder="Digite..." />
   <AdminInput as="select" label="Categoria"><option>...</option></AdminInput>
   <AdminInput as="textarea" label="Descrição" />
   ============================================================ */
export function AdminInput({ label, as = 'input', ...props }) {
  const Tag = as;
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 11, fontWeight: 700,
          color: C.textMuted, letterSpacing: 1,
          textTransform: 'uppercase', marginBottom: 6,
          fontFamily: F.mono,
        }}>{label}</label>
      )}
      <Tag
        {...props}
        style={{
          background: C.bgInput,
          border: `1px solid ${C.borderInput}`,
          borderRadius: 8, padding: '10px 14px',
          fontSize: 13, color: C.textPrimary,
          fontFamily: F.body, width: '100%',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          ...(as === 'textarea' ? { minHeight: 100, resize: 'vertical' } : {}),
          ...props.style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(226,184,74,0.5)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(226,184,74,0.1)';
          props.onFocus && props.onFocus(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = C.borderInput;
          e.currentTarget.style.boxShadow = 'none';
          props.onBlur && props.onBlur(e);
        }}
      />
    </div>
  );
}


/* ============================================================
   ADMIN TABS
   <AdminTabs tabs={['Fechamento','Conciliação']} active={0} onChange={setActive} />
   ============================================================ */
export function AdminTabs({ tabs = [], active = 0, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
      {tabs.map((tab, i) => (
        <button
          key={i}
          onClick={() => onChange && onChange(i)}
          style={{
            padding: '8px 18px', borderRadius: 8,
            fontSize: 13, cursor: 'pointer',
            fontFamily: F.body,
            fontWeight: active === i ? 700 : 500,
            background: active === i ? C.gold : 'transparent',
            color: active === i ? C.bg : C.textSecondary,
            border: `1px solid ${active === i ? C.gold : C.border}`,
            transition: 'all 0.15s',
          }}
        >{tab}</button>
      ))}
    </div>
  );
}


/* ============================================================
   SECTION HEADER
   <SectionHeader title="Aguardando Pagamento" count={1} type="warning" />
   ============================================================ */
export function SectionHeader({ title, count, type = 'neutral', danger }) {
  const colors = {
    warning: { bg: C.warningBg, color: C.warning },
    danger:  { bg: C.dangerBg,  color: C.danger },
    neutral: { bg: 'rgba(255,255,255,0.06)', color: C.textSecondary },
  };
  const s = colors[type] || colors.neutral;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
    }}>
      <span style={{
        fontWeight: 700, fontSize: 14,
        color: danger ? C.danger : C.textPrimary,
      }}>{title}</span>
      {count != null && (
        <span style={{
          width: 20, height: 20, borderRadius: '50%',
          background: s.bg, color: s.color,
          fontSize: 11, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: F.mono,
        }}>{count}</span>
      )}
    </div>
  );
}


/* ============================================================
   EMPTY STATE
   <EmptyState icon="📦" title="Sem dados" text="Nenhum pedido." />
   ============================================================ */
export function EmptyState({ icon = '📦', title, text }) {
  return (
    <div style={{
      textAlign: 'center', padding: '60px 20px',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: `linear-gradient(135deg, ${C.teal}, ${C.tealLight})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px', fontSize: 28,
      }}>{icon}</div>
      {title && (
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: C.textPrimary, marginBottom: 8,
        }}>{title}</div>
      )}
      {text && (
        <div style={{ fontSize: 13, color: C.textSecondary }}>{text}</div>
      )}
    </div>
  );
}
