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

function ShortcutCard({ to, title, description, variant = 'default', disabled = false, onClick }) {
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
      <Link className={`conta-shortcut-card ${variant === 'primary' ? 'is-primary' : ''}`.trim()} to={to}>
        {body}
      </Link>
    );
  }

  return (
    <button className={`conta-shortcut-card is-button ${variant === 'primary' ? 'is-primary' : ''}`.trim()} type="button" disabled={disabled} onClick={onClick}>
      {body}
    </button>
  );
}

export default function ShortcutsSection({ recorrenciaStats, pedidosResumo, mostrarCupons = false, onAcaoEmBreve }) {
  const totalPedidos = Number(pedidosResumo?.total || 0);
  const totalFavoritos = Number(recorrenciaStats?.favoritos || 0);
  const totalRecompra = Number(recorrenciaStats?.recompra || 0);
  const ultimoPedidoTexto = String(pedidosResumo?.ultimoPedidoTexto || '').trim();

  return (
    <article className="card-box conta-section-card">
      <div className="conta-section-head">
        <span className="conta-section-icon"><IconShortcut /></span>
        <div>
          <h3>Pedidos e atalhos principais</h3>
          <p>Ações rápidas para o que você mais usa no dia a dia.</p>
        </div>
      </div>

      <div className="conta-shortcuts-kpis" aria-label="Resumo de uso da conta">
        <p className="conta-shortcuts-kpi"><small>Pedidos</small><strong>{totalPedidos}</strong></p>
        <p className="conta-shortcuts-kpi"><small>Favoritos</small><strong>{totalFavoritos}</strong></p>
        <p className="conta-shortcuts-kpi"><small>Comprar novamente</small><strong>{totalRecompra}</strong></p>
      </div>

      {ultimoPedidoTexto ? <p className="conta-shortcuts-last">{ultimoPedidoTexto}</p> : null}

      <div className="conta-shortcuts-grid">
        <ShortcutCard
          to="/pedidos"
          title="Meus pedidos"
          description="Acompanhar histórico e andamento."
          variant="primary"
        />
        <ShortcutCard to="/produtos?recorrencia=favoritos" title="Favoritos" description="Abrir produtos salvos." />
        <ShortcutCard
          to="/produtos?recorrencia=recompra"
          title="Comprar novamente"
          description={totalRecompra > 0 ? `Você tem ${totalRecompra} sugest${totalRecompra > 1 ? 'oes' : 'ao'} pronta.` : 'Montar carrinho com suas compras frequentes.'}
        />
        {mostrarCupons ? <ShortcutCard title="Cupons" description="Ver cupons disponíveis." onClick={() => onAcaoEmBreve('Cupons')} /> : null}
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
