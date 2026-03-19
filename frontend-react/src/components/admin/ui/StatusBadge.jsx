import React from 'react';
import { LABELS_STATUS, COR_STATUS } from './adminUtils';

export default function StatusBadge({ status, size }) {
  const label = LABELS_STATUS[status] || status;
  const cor = COR_STATUS[status] || '#94a3b8';
  const cls = `ck-status-badge ${size === 'sm' ? 'sm' : ''} is-${status}`;

  return (
    <span className={cls} style={{ '--badge-color': cor }}>
      {label}
    </span>
  );
}
