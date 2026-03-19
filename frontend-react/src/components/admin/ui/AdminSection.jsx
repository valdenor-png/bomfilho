import React from 'react';

export default function AdminSection({ title, subtitle, actions, children }) {
  return (
    <section className="adm-section">
      {(title || actions) ? (
        <div className="adm-section-header">
          <div>
            {title ? <h3 className="adm-section-title">{title}</h3> : null}
            {subtitle ? <p className="adm-section-subtitle">{subtitle}</p> : null}
          </div>
          {actions || null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
