import React from 'react';

export default function PaymentsHub({ onActionSoon }) {
  return (
    <section className="account-hub-panel" aria-label="Pagamentos">
      <header className="account-hub-head">
        <h3>Pagamentos</h3>
        <p>Gerenciado com segurança pelo Mercado Pago.</p>
      </header>

      <div className="account-hub-card-list">
        <article className="account-hub-card">
          <p className="account-hub-card-title">Métodos atuais</p>
          <p>PIX, cartão de crédito e cartão de débito no checkout.</p>
        </article>

        <article className="account-hub-card">
          <p className="account-hub-card-title">Segurança dos dados</p>
          <p>Dados do cartão processados e tokenizados pelo Mercado Pago.</p>
          <p>O BomFilho não armazena os dados completos do seu cartão.</p>
        </article>

        <article className="account-hub-card">
          <p className="account-hub-card-title">Cartões salvos</p>
          <p>
            Esta área já está preparada para exibir cartões reutilizáveis quando a integração
            segura do Mercado Pago estiver disponível neste ambiente.
          </p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onActionSoon('Cartões salvos no Mercado Pago')}
          >
            Entendi
          </button>
        </article>
      </div>
    </section>
  );
}
