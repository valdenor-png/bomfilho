import React from 'react';
import { useNavigate } from 'react-router-dom';

function podeVoltarHistorico() {
  if (typeof window === 'undefined') {
    return false;
  }

  const idx = Number(window.history?.state?.idx);
  if (Number.isFinite(idx)) {
    return idx > 0;
  }

  return window.history.length > 1;
}

export default function InternalTopBar({
  title,
  subtitle = '',
  onBack,
  fallbackTo = '/',
  backLabel = 'Voltar para a tela anterior',
  showBack = true,
  backIconOnly = false,
  centerTitle = false,
  rightActionLabel = '',
  onRightAction,
  rightActionAriaLabel = 'Acao rapida',
  rightActionDisabled = false,
  className = ''
}) {
  const navigate = useNavigate();
  const hasRightAction = Boolean(String(rightActionLabel || '').trim()) && typeof onRightAction === 'function';

  function handleBack() {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }

    if (podeVoltarHistorico()) {
      navigate(-1);
      return;
    }

    navigate(fallbackTo, { replace: true });
  }

  return (
    <header
      className={`internal-topbar ${showBack ? 'with-back' : 'without-back'} ${centerTitle ? 'center-title' : ''} ${hasRightAction ? 'has-right-action' : ''} ${className}`.trim()}
    >
      {showBack ? (
        <button
          type="button"
          className={`internal-topbar-back ${backIconOnly ? 'icon-only' : ''}`.trim()}
          onClick={handleBack}
          aria-label={backLabel}
        >
          <span aria-hidden="true">←</span>
          {!backIconOnly ? <span>Voltar</span> : null}
        </button>
      ) : null}

      <div className="internal-topbar-copy">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      {hasRightAction ? (
        <button
          type="button"
          className="internal-topbar-right-action"
          onClick={onRightAction}
          aria-label={rightActionAriaLabel}
          disabled={rightActionDisabled}
        >
          {rightActionLabel}
        </button>
      ) : null}
    </header>
  );
}
