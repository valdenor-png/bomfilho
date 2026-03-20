import React from 'react';
import { Link } from 'react-router-dom';
import { STORE_WHATSAPP_URL } from '../../config/store';

function IconShortcut() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="conta-icon-svg">
      <path d="m15 5-1.41 1.41L18.17 11H2v2h16.17l-4.59 4.59L15 19l7-7z" />
    </svg>
  );
}

function ShortcutCard({ to, title, description, disabled = false, onClick }) {
  const body = (
    <>
      <span className="conta-shortcut-icon"><IconShortcut /></span>
      <span className="conta-shortcut-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </>
  );

  if (!disabled && to) {
    return (
      <Link className="conta-shortcut-card" to={to}>
        {body}
      </Link>
    );
  }

  return (
    <button className="conta-shortcut-card is-button" type="button" disabled={disabled} onClick={onClick}>
      {body}
    </button>
  );
}

export default function ShortcutsSection({ recorrenciaStats }) {
  return (
    <article className="card-box conta-section-card">
      <div className="conta-section-head">
        <span className="conta-section-icon"><IconShortcut /></span>
        <div>
          <h3>Atalhos úteis</h3>
          <p>Links rápidos para pedidos, recompra e suporte.</p>
        </div>
      </div>

      <p className="muted-text conta-shortcuts-resumo">
        Favoritos: {recorrenciaStats.favoritos} • Recompra: {recorrenciaStats.recompra}
      </p>

      <div className="conta-shortcuts-grid">
        <ShortcutCard to="/pedidos" title="Meus pedidos" description="Ver histórico e andamento." />
        <ShortcutCard to="/produtos?recorrencia=favoritos" title="Favoritos" description="Abrir produtos salvos." />
        <ShortcutCard to="/produtos?recorrencia=recompra" title="Comprar novamente" description="Repetir compras frequentes." />
        <ShortcutCard disabled title="Cupons" description="Disponível em breve." />
        <ShortcutCard
          title="Ajuda / suporte"
          description="Falar com o atendimento."
          onClick={() => {
            window.open(STORE_WHATSAPP_URL, '_blank', 'noopener,noreferrer');
          }}
        />
      </div>
    </article>
  );
}
