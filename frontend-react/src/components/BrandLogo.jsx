import React from 'react';

export default function BrandLogo({
  subtitle = '',
  tagline = '',
  compact = false,
  titleTag = 'h1'
}) {
  const TitleTag = titleTag;

  return (
    <div className={`brand-logo ${compact ? 'is-compact' : ''}`}>
      <div className="brand-logo-seal" aria-hidden="true">
        <img src="/img/logo-oficial.png" alt="" className="brand-logo-seal-image" />
      </div>

      <div className="brand-logo-copy">
        <p className="brand-logo-kicker">Comercio</p>

        <TitleTag className="brand-logo-wordmark" aria-label="Bomfilho">
          <span className="brand-logo-wordmark-text">Bomfilho</span>
        </TitleTag>

        <div className="brand-logo-accent-row" aria-hidden="true">
          <span className="brand-logo-accent is-yellow" />
          <span className="brand-logo-accent is-blue" />
        </div>

        {subtitle ? <p className="brand-logo-subtitle">{subtitle}</p> : null}
        {tagline ? <p className="brand-logo-tagline">{tagline}</p> : null}
      </div>
    </div>
  );
}
