import React from 'react';
import { colors, fonts, radius } from '../../styles/tokens';

// <InputField label="Nome" value={name} onChange={setName} placeholder="Produto..." />
// <InputField label="Buscar" icon={<Search size={14} />} ... />

const labelStyle = {
  display: 'block', fontSize: 10, fontWeight: 600,
  color: colors.dim, textTransform: 'uppercase',
  letterSpacing: '0.8px', marginBottom: 4,
  fontFamily: fonts.text,
};

const inputStyle = {
  width: '100%', padding: '10px 14px',
  borderRadius: radius.md,
  background: colors.bgCard,
  border: `1px solid ${colors.border}`,
  color: colors.white, fontSize: 13,
  fontFamily: fonts.text, outline: 'none',
  transition: 'border-color 0.15s',
};

export default function InputField({ label, value, onChange, placeholder, type, icon, disabled, style, inputStyle: extraInputStyle, ...rest }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: colors.dim, pointerEvents: 'none',
          }}>
            {icon}
          </span>
        )}
        <input
          type={type || 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            ...inputStyle,
            ...(icon ? { paddingLeft: 36 } : {}),
            ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
            ...extraInputStyle,
          }}
          {...rest}
        />
      </div>
    </div>
  );
}
