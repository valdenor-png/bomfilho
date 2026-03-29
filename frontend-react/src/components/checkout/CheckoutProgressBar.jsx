import React from 'react';

const STEPS = [
  { key: 'carrinho', label: 'Carrinho' },
  { key: 'entrega', label: 'Entrega' },
  { key: 'aguardando', label: 'Aguardando' },
  { key: 'pagamento', label: 'Pagamento' },
];

const ETAPA_MAP = {
  CARRINHO: 0,
  ENTREGA: 1,
  PAGAMENTO: 2,
  REVISAO_CLIENTE: 2,
  REVISAO: 2,
  PIX: 3,
  STATUS: 3,
};

export default function CheckoutProgressBar({ etapaAtual }) {
  const currentIndex = ETAPA_MAP[etapaAtual] ?? 0;

  return (
    <div className="ck-progress">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.key}>
          <div className={`ck-progress-step ${i < currentIndex ? 'is-done' : ''} ${i === currentIndex ? 'is-active' : ''} ${i > currentIndex ? 'is-future' : ''}`}>
            <div className="ck-progress-circle">
              {i < currentIndex ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <span className="font-sora">{i + 1}</span>
              )}
            </div>
            <span className="ck-progress-label">{step.label}</span>
          </div>
          {i < STEPS.length - 1 ? (
            <div className={`ck-progress-line ${i < currentIndex ? 'is-done' : ''}`} />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}
