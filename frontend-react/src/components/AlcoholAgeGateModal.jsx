import React from 'react';

export default function AlcoholAgeGateModal({
  open = false,
  produtoNome = 'Bebida alcoolica',
  onConfirm,
  onCancel
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="age-gate-overlay" role="presentation" onClick={onCancel}>
      <section
        className="age-gate-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Confirmacao de maioridade"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="age-gate-kicker">Aviso 18+</p>
        <h2>Venda proibida para menores de 18 anos.</h2>
        <p>
          Ao continuar, voce declara ser maior de 18 anos.
        </p>
        <p className="age-gate-product">Item: <strong>{produtoNome}</strong></p>

        <div className="age-gate-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            Tenho 18 anos ou mais
          </button>
        </div>
      </section>
    </div>
  );
}
