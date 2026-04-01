import React from 'react';
import { colors, fonts, radius } from '../../styles/tokens';

// <SelectField label="Status" value={status} onChange={setStatus} options={[{value:'todos',label:'Todos'}]} />

const labelStyle = {
  display: 'block', fontSize: 10, fontWeight: 600,
  color: colors.dim, textTransform: 'uppercase',
  letterSpacing: '0.8px', marginBottom: 4,
  fontFamily: fonts.text,
};

const selectStyle = {
  width: '100%', padding: '10px 14px',
  borderRadius: radius.md,
  background: colors.bgCard,
  border: `1px solid ${colors.border}`,
  color: colors.white, fontSize: 13,
  fontFamily: fonts.text, outline: 'none',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235C7E74' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};

export default function SelectField({ label, value, onChange, options = [], style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {label && <label style={labelStyle}>{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={selectStyle}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
