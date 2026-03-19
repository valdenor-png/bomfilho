import React from 'react';

export default function AdminFilterBar({ children }) {
  return (
    <div className="adm-filter-bar">
      {children}
    </div>
  );
}

export function FilterGroup({ label, wide, children }) {
  return (
    <div className={`adm-filter-group${wide ? ' wide' : ''}`}>
      {label ? <span className="adm-filter-label">{label}</span> : null}
      {children}
    </div>
  );
}

export function FilterActions({ children }) {
  return (
    <div className="adm-filter-actions">
      {children}
    </div>
  );
}
