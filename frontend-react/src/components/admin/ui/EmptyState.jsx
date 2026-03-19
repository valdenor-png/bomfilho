import React from 'react';

export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div className="ck-empty-state">
      {icon && <div className="ck-empty-icon">{icon}</div>}
      <h3 className="ck-empty-title">{title || 'Nenhum dado encontrado'}</h3>
      {description && <p className="ck-empty-desc">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="ck-empty-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
