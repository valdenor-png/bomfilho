import React from 'react';

export default function AdminMetricCard({ label, value, sub, tone }) {
  const cls = `adm-metric-card${tone ? ` is-${tone}` : ''}`;
  return (
    <article className={cls}>
      <span className="adm-metric-label">{label}</span>
      <strong className="adm-metric-value">{value}</strong>
      {sub ? <small className="adm-metric-sub">{sub}</small> : null}
    </article>
  );
}
