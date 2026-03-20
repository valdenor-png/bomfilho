import React from 'react';
import SwitchControl from './SwitchControl';
import { FONT_SCALE_OPTIONS } from '../../lib/accessibility';

function IconAccessibility() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="M12 2a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm7 5H5v2h5v13h2V9h5Z" />
    </svg>
  );
}

export default function AccessibilitySection({
  fontScale,
  highContrast,
  reducedMotion,
  onFontScaleChange,
  onHighContrastChange,
  onReducedMotionChange,
  descricao
}) {
  return (
    <article className="card-box conta-section-card conta-accessibility-card">
      <div className="conta-section-head">
        <span className="conta-section-icon"><IconAccessibility /></span>
        <div>
          <h3>Acessibilidade</h3>
          <p>{descricao || 'Ajustes rápidos para leitura e conforto visual.'}</p>
        </div>
      </div>

      <p className="conta-font-hint">Tamanho do texto</p>
      <div className="conta-font-row" role="group" aria-label="Ajustar tamanho da fonte">
        {FONT_SCALE_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`btn-secondary conta-font-btn ${fontScale === option.value ? 'active' : ''}`}
            aria-pressed={fontScale === option.value}
            onClick={() => onFontScaleChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="switch-list" aria-label="Recursos de acessibilidade">
        <SwitchControl
          id="toggle-high-contrast"
          label="Alto contraste"
          description="Aumenta contraste de textos e elementos."
          checked={highContrast}
          onChange={onHighContrastChange}
        />

        <SwitchControl
          id="toggle-reduced-motion"
          label="Reduzir animações"
          description="Diminui efeitos e transições visuais."
          checked={reducedMotion}
          onChange={onReducedMotionChange}
        />
      </div>
    </article>
  );
}
