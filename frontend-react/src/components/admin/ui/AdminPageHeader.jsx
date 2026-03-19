import React from 'react';

export default function AdminPageHeader({ title, subtitle, children }) {
  return (
    <div className="adm-page-header">
      <div className="adm-page-header-main">
        <h2 className="adm-page-title">{title}</h2>
        {subtitle ? <p className="adm-page-subtitle">{subtitle}</p> : null}
      </div>
      {children ? <div className="adm-page-meta">{children}</div> : null}
    </div>
  );
}
