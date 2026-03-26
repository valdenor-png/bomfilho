import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReviewTracker } from '../../context/ReviewTrackerContext';

function formatRelativeSync(syncIso) {
  const syncMs = Number(new Date(syncIso || 0).getTime());
  if (!Number.isFinite(syncMs) || syncMs <= 0) {
    return 'Atualização recente';
  }

  const elapsedSec = Math.max(0, Math.floor((Date.now() - syncMs) / 1000));
  if (elapsedSec < 5) {
    return 'Atualizado agora';
  }

  if (elapsedSec < 60) {
    return `Atualizado há ${elapsedSec}s`;
  }

  const minutes = Math.floor(elapsedSec / 60);
  return `Atualizado há ${minutes} min`;
}

function getMetaByState(reviewState) {
  const state = String(reviewState || '').trim().toLowerCase();

  if (state === 'aprovado') {
    return {
      tone: 'is-approved',
      title: 'Pedido aprovado',
      badge: 'Pagamento liberado'
    };
  }

  if (state === 'nao_aprovado') {
    return {
      tone: 'is-rejected',
      title: 'Pedido não aprovado',
      badge: 'Ajuste necessário'
    };
  }

  if (state === 'expirado') {
    return {
      tone: 'is-expired',
      title: 'Revisão expirada',
      badge: 'Ação necessária'
    };
  }

  if (state === 'pago') {
    return {
      tone: 'is-paid',
      title: 'Pagamento confirmado',
      badge: 'Pedido em andamento'
    };
  }

  return {
    tone: 'is-review',
    title: 'Pedido em revisão',
    badge: 'Em revisão'
  };
}

export default function ReviewTrackerWidget({ hasBottomNav = false, hasGlobalCartBar = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tracker, expanded, setExpanded, clearTracking, isTracking } = useReviewTracker();

  const meta = useMemo(() => getMetaByState(tracker?.reviewState), [tracker?.reviewState]);

  const positionClass = `${hasBottomNav ? 'is-with-bottom-nav' : ''} ${hasGlobalCartBar ? 'is-with-global-cart' : ''}`.trim();

  if (!isTracking || !tracker?.orderId) {
    return null;
  }

  const abrirPagamento = () => {
    navigate(`/pagamento?pedido=${tracker.orderId}&etapa=pagamento`);
  };

  const abrirRevisao = () => {
    navigate(`/pagamento?pedido=${tracker.orderId}&etapa=revisao`);
  };

  const irParaPedidos = () => {
    navigate('/pedidos');
  };

  const continuarNavegando = () => {
    setExpanded(false);
    if (location.pathname !== '/produtos') {
      navigate('/produtos');
    }
  };

  return (
    <aside className={`review-tracker-fab ${meta.tone} ${positionClass}`.trim()} aria-live="polite">
      <button
        className="review-tracker-toggle"
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <div className="review-tracker-toggle-copy">
          <p className="review-tracker-kicker">Pedido #{tracker.orderId}</p>
          <strong>{meta.title}</strong>
          <span>{meta.badge}</span>
        </div>
        <span className="review-tracker-pulse" aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="review-tracker-panel">
          <p className="review-tracker-message">{tracker.reviewMessage}</p>
          {tracker.revisaoObs ? (
            <p className="review-tracker-observation">Observação da equipe: {tracker.revisaoObs}</p>
          ) : null}

          <div className="review-tracker-meta-row">
            <span>{formatRelativeSync(tracker.lastSyncAt)}</span>
            {tracker.pollError ? <span className="review-tracker-error">Atualização instável</span> : null}
          </div>

          <div className="review-tracker-actions">
            {tracker.reviewState === 'aprovado' ? (
              <button className="btn-primary" type="button" onClick={abrirPagamento}>
                Ir para pagamento
              </button>
            ) : tracker.reviewState === 'em_revisao' ? (
              <button className="btn-primary" type="button" onClick={abrirRevisao}>
                Abrir revisão
              </button>
            ) : (
              <button className="btn-primary" type="button" onClick={irParaPedidos}>
                Ir para meus pedidos
              </button>
            )}

            <button className="btn-secondary" type="button" onClick={continuarNavegando}>
              Continuar navegando
            </button>

            <button className="btn-secondary" type="button" onClick={clearTracking}>
              Fechar aviso
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

