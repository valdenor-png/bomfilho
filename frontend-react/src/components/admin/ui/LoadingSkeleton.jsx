import React from 'react';

export default function LoadingSkeleton({ lines = 4, type = 'default' }) {
  if (type === 'kpis') {
    return (
      <div className="ck-skeleton-grid">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="ck-skeleton-kpi">
            <div className="ck-skeleton-line w40 mb8" />
            <div className="ck-skeleton-line w60 h24 mb4" />
            <div className="ck-skeleton-line w30" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="ck-skeleton-table">
        <div className="ck-skeleton-row header">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="ck-skeleton-cell"><div className="ck-skeleton-line w80" /></div>)}
        </div>
        {Array.from({ length: lines }, (_, i) => (
          <div className="ck-skeleton-row" key={i}>
            {[1, 2, 3, 4, 5].map(j => <div key={j} className="ck-skeleton-cell"><div className="ck-skeleton-line" style={{ width: `${50 + Math.random() * 40}%` }} /></div>)}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className="ck-skeleton-cards">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="ck-skeleton-card">
            <div className="ck-skeleton-line w60 mb8" />
            <div className="ck-skeleton-line w90 mb4" />
            <div className="ck-skeleton-line w40" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="ck-skeleton-default">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="ck-skeleton-line" style={{ width: `${60 + Math.random() * 35}%`, marginBottom: '0.6rem' }} />
      ))}
    </div>
  );
}
