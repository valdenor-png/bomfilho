import React from 'react';

export default function ErrorState({ message, onRetry, compact }) {
  if (compact) {
    return (
      <div className="ck-error-compact">
        <span className="ck-error-icon">⚠️</span>
        <span className="ck-error-msg">{message || 'Erro ao carregar dados.'}</span>
        {onRetry && <button type="button" className="ck-error-retry-sm" onClick={onRetry}>Tentar novamente</button>}
      </div>
    );
  }

  return (
    <div className="ck-error-state">
      <div className="ck-error-visual">
        <span className="ck-error-icon-lg">⚠️</span>
      </div>
      <h3 className="ck-error-title">Falha ao carregar</h3>
      <p className="ck-error-desc">{message || 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.'}</p>
      {onRetry && (
        <button type="button" className="ck-error-retry" onClick={onRetry}>
          🔄 Tentar novamente
        </button>
      )}
    </div>
  );
}
