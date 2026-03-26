import React, { useEffect, useMemo, useState } from 'react';
import { X } from '../../icons';
import { STORE_WHATSAPP_URL, STORE_NAME, STORE_TELEFONE_DISPLAY } from '../../config/store';
import { captureCommerceEvent } from '../../lib/commerceTracking';
import {
  getPedidoDeliveryTracking,
  registrarPedidoDeliveryEvento
} from '../../lib/api';

const HELP_OPTIONS = [
  { key: 'atraso', title: 'Meu pedido está demorando', target: 'loja' },
  { key: 'sem_contato_entregador', title: 'Não consigo falar com o entregador', target: 'provider_or_loja' },
  { key: 'endereco_dificil', title: 'Endereço incompleto ou difícil de achar', target: 'loja' },
  { key: 'avisar_chegada', title: 'Quero avisar que cheguei/estou aguardando', target: 'loja' },
  { key: 'outra_pessoa_recebe', title: 'Outra pessoa vai receber', target: 'loja' },
  { key: 'marcado_entregue_nao_recebi', title: 'Foi marcado como entregue e não recebi', target: 'urgente' },
  { key: 'problema_entrega', title: 'Produto faltando ou problema na entrega', target: 'urgente' }
];

const LIVE_STATUSES = new Set(['pending', 'pickup', 'in_transit', 'near']);
const PIN_REVEAL_STATUSES = new Set(['in_transit', 'near']);
const FINAL_STATUSES = new Set(['delivered', 'canceled', 'returned']);

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatEtaRange(min, max) {
  const etaMin = Number(min || 0);
  const etaMax = Number(max || 0);

  if (etaMin > 0 && etaMax >= etaMin) {
    return `${etaMin}-${etaMax} min`;
  }

  return 'Atualizando previsão';
}

function formatAddress(endereco = {}) {
  const ruaNumero = [endereco?.rua, endereco?.numero].filter(Boolean).join(', ');
  const bairro = String(endereco?.bairro || '').trim();
  const cidadeEstado = [endereco?.cidade, endereco?.estado].filter(Boolean).join(' / ');
  const cep = String(endereco?.cep || '').trim();

  const linhaBase = [ruaNumero, bairro, cidadeEstado, cep].filter(Boolean).join(' · ');
  const complemento = String(endereco?.complemento || '').trim();
  const referencia = String(endereco?.referencia || '').trim();

  return {
    linhaBase: linhaBase || 'Endereço em confirmação com a loja.',
    complemento: complemento || null,
    referencia: referencia || null
  };
}

function getProviderLabel(provider, mode) {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const normalizedMode = String(mode || '').trim().toLowerCase();

  if (normalizedProvider === 'uber') {
    if (normalizedMode === 'bike') return 'Uber Bike';
    if (normalizedMode === 'moto') return 'Uber Moto';
    if (normalizedMode === 'carro') return 'Uber Carro';
    return 'Entrega parceira Uber';
  }

  if (normalizedProvider === 'own_bike') {
    return 'Entrega local BomFilho';
  }

  return 'Entrega em preparação';
}

function getHeaderTrustMessage(statusInternal) {
  const normalized = String(statusInternal || '').trim().toLowerCase();
  if (normalized === 'near') {
    return 'Informe o código de entrega somente quando estiver com seus itens em mãos.';
  }
  if (normalized === 'delivered') {
    return 'Entrega concluída com segurança. Qualquer divergência, nossa equipe ajuda você.';
  }
  if (normalized === 'canceled' || normalized === 'returned') {
    return 'A entrega foi interrompida. Nossa equipe está pronta para resolver com prioridade.';
  }

  return 'Seu pedido está protegido por acompanhamento de entrega em tempo real.';
}

function isUberProvider(provider) {
  return String(provider || '').trim().toLowerCase() === 'uber';
}

function DeliveryTimeline({ timeline = [], statusInternal = 'pending' }) {
  const statusRank = {
    pending: 10,
    pickup: 20,
    in_transit: 30,
    near: 40,
    delivered: 50,
    returned: 60,
    canceled: 70
  };

  const currentRank = statusRank[String(statusInternal || '').trim().toLowerCase()] || 10;

  return (
    <ol className="delivery-timeline" aria-label="Linha do tempo da entrega">
      {(timeline || []).map((step, index) => {
        const hasTime = Boolean(step?.at);
        const done = hasTime;
        const current = !done && index > 0 && (timeline[index - 1]?.at || currentRank > (index + 1) * 5);

        return (
          <li key={step?.key || `${index}`} className={`delivery-timeline-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`.trim()}>
            <span className="delivery-timeline-dot" aria-hidden="true" />
            <div className="delivery-timeline-copy">
              <p className="delivery-timeline-title">{step?.title || 'Etapa da entrega'}</p>
              <p className="delivery-timeline-description">{step?.description || ''}</p>
              {hasTime ? <small>{formatDateTime(step.at)}</small> : <small>Em andamento</small>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DeliveryHelpModal({ open, onClose, pedidoId, onRegisterEvent, provider, trackingUrl }) {
  if (!open) {
    return null;
  }

  return (
    <div className="delivery-help-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="delivery-help-modal" role="dialog" aria-modal="true" aria-label="Central de ajuda da entrega" onClick={(event) => event.stopPropagation()}>
        <header className="delivery-help-head">
          <h4>Precisa de ajuda com a entrega?</h4>
          <button type="button" className="delivery-help-close" onClick={onClose} aria-label="Fechar ajuda">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <p className="delivery-help-subtitle">Escolha o assunto e vamos orientar o melhor caminho, sem enrolação.</p>

        <div className="delivery-help-list">
          {HELP_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="delivery-help-item"
              onClick={() => {
                void onRegisterEvent('report_issue', {
                  help_topic: item.key,
                  help_target: item.target,
                  provider
                });

                if (item.target === 'provider_or_loja' && isUberProvider(provider) && trackingUrl) {
                  window.open(trackingUrl, '_blank', 'noopener,noreferrer');
                } else {
                  window.open(STORE_WHATSAPP_URL, '_blank', 'noopener,noreferrer');
                }
              }}
            >
              <span>{item.title}</span>
              <small>
                {item.target === 'urgente'
                  ? 'Prioridade alta com suporte da loja'
                  : item.target === 'provider_or_loja'
                    ? 'Canal oficial da entrega quando disponível'
                    : 'Contato direto com a loja'}
              </small>
            </button>
          ))}
        </div>

        <footer className="delivery-help-footer">
          <small>Pedido #{pedidoId}. Se preferir, fale direto com a loja.</small>
          <a className="btn-secondary" href={STORE_WHATSAPP_URL} target="_blank" rel="noreferrer">Falar com a loja</a>
        </footer>
      </section>
    </div>
  );
}

export default function DeliveryTrackingPanel({ pedidoId, pedidoResumo, open, onClose, onRepeatOrder }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [receiverNote, setReceiverNote] = useState('');
  const [savingReceiver, setSavingReceiver] = useState(false);

  const provider = String(data?.provider || '').trim().toLowerCase();
  const statusInternal = String(data?.status_internal || '').trim().toLowerCase();
  const isLive = LIVE_STATUSES.has(statusInternal);

  useEffect(() => {
    if (!open || !pedidoId) {
      return;
    }

    let mounted = true;

    async function loadTracking() {
      if (!mounted) {
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await getPedidoDeliveryTracking(pedidoId);
        if (!mounted) {
          return;
        }

        setData(response || null);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err?.message || 'Não foi possível carregar o acompanhamento da entrega.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadTracking();

    return () => {
      mounted = false;
    };
  }, [open, pedidoId]);

  useEffect(() => {
    if (!open || !pedidoId || !isLive) {
      return undefined;
    }

    const intervalId = setInterval(async () => {
      try {
        const response = await getPedidoDeliveryTracking(pedidoId);
        setData(response || null);
      } catch {
        // fallback silencioso para não gerar flicker no painel
      }
    }, 12000);

    return () => clearInterval(intervalId);
  }, [open, pedidoId, isLive]);

  useEffect(() => {
    if (!data?.recipient) {
      return;
    }

    setReceiverName(String(data.recipient?.name || ''));
    setReceiverNote(String(data.recipient?.note || ''));
  }, [data]);

  const addressView = useMemo(() => formatAddress(data?.endereco), [data]);
  const etaText = formatEtaRange(data?.eta_min, data?.eta_max);
  const providerLabel = getProviderLabel(data?.provider, data?.mode);
  const trackingUrl = String(data?.tracking_url || '').trim() || null;
  const securityMessage = getHeaderTrustMessage(statusInternal);
  const canTalkToCourier = isUberProvider(provider) && trackingUrl;
  const shouldHighlightPin = Boolean(data?.safety_pin) && (statusInternal === 'near' || statusInternal === 'in_transit');
  const isFinalStatus = FINAL_STATUSES.has(statusInternal);
  const isCanceledStatus = statusInternal === 'canceled';
  const canRevealPin = PIN_REVEAL_STATUSES.has(statusInternal);
  const showTrackingFallback = isUberProvider(provider) && !trackingUrl;
  const trackingPrimaryLabel = isUberProvider(provider) ? 'Ver localização do entregador' : 'Acompanhar entrega';
  const hasCourierLocation = Number.isFinite(Number(data?.courier?.lat)) && Number.isFinite(Number(data?.courier?.lng));

  async function registerEvent(action, metadata = {}) {
    try {
      await registrarPedidoDeliveryEvento(pedidoId, { action, metadata });
    } catch {
      // nao bloqueia UX por falha analitica
    }

    captureCommerceEvent('delivery_tracking_action', {
      order_id: Number(pedidoId || 0),
      action,
      provider,
      status_internal: statusInternal,
      ...metadata
    });
  }

  async function handleShareStatus() {
    const shareText = `Pedido #${pedidoId} no ${STORE_NAME}: ${data?.status_label || 'em andamento'} (${etaText}).`;

    await registerEvent('share_status', { source: 'tracking_panel' });

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pedido #${pedidoId}`,
          text: shareText,
          url: window.location.href
        });
        return;
      } catch {
        // fallback abaixo
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      window.alert('Status copiado para compartilhar.');
    } catch {
      window.prompt('Copie o status para compartilhar:', shareText);
    }
  }

  async function handleSaveReceiver() {
    setSavingReceiver(true);
    try {
      await registerEvent('set_receiver', {
        receiver_name: String(receiverName || '').trim(),
        receiver_note: String(receiverNote || '').trim()
      });
      window.alert('Informações de recebimento atualizadas com sucesso.');
    } finally {
      setSavingReceiver(false);
    }
  }

  async function reloadTracking() {
    setLoading(true);
    setError('');
    try {
      const response = await getPedidoDeliveryTracking(pedidoId);
      setData(response || null);
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar o acompanhamento da entrega.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="delivery-tracking-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="delivery-tracking-drawer" role="dialog" aria-modal="true" aria-label="Acompanhamento da entrega" onClick={(event) => event.stopPropagation()}>
        <header className="delivery-tracking-header">
          <div>
            <p className="delivery-tracking-kicker">Acompanhamento da entrega</p>
            <h3>{data?.status_label || 'Seu pedido está em andamento'}</h3>
            <p>{data?.status_message || 'Estamos acompanhando seu pedido com atualização constante.'}</p>
          </div>
          <button className="delivery-tracking-close" type="button" onClick={onClose} aria-label="Fechar acompanhamento">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="delivery-tracking-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="delivery-tracking-state is-error">
            <strong>Não conseguimos atualizar agora.</strong>
            <p>{error}</p>
            <button type="button" className="btn-secondary" onClick={() => { void reloadTracking(); }}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        {!loading && !error && !data ? (
          <div className="delivery-tracking-state">
            <strong>Acompanhamento em preparação.</strong>
            <p>Estamos organizando os detalhes da sua entrega. Tente atualizar em instantes.</p>
            <button type="button" className="btn-secondary" onClick={() => { void reloadTracking(); }}>
              Atualizar agora
            </button>
          </div>
        ) : null}

        {!loading && !error && data ? (
          <>
            <section className="delivery-trust-head">
              <p className="delivery-trust-badge">Entrega protegida</p>
              <p className="delivery-trust-copy">{securityMessage}</p>
              <div className="delivery-trust-meta">
                <span>Pedido #{pedidoId}</span>
                <span>{formatDateTime(data?.created_at)}</span>
                <span>{data?.payment_status_label || 'Pagamento em análise'}</span>
              </div>
              <p className="delivery-trust-eta">Previsão de entrega: <strong>{etaText}</strong></p>
            </section>

            <section className="delivery-main-card">
              <header>
                <h4>{providerLabel}</h4>
                <small>{isUberProvider(provider) ? 'Entrega parceira com rastreio oficial' : 'Entrega local BomFilho'}</small>
              </header>
              <p className="delivery-main-address"><strong>Endereço:</strong> {addressView.linhaBase}</p>
              {addressView.complemento ? <p className="delivery-main-extra"><strong>Complemento:</strong> {addressView.complemento}</p> : null}
              {addressView.referencia ? <p className="delivery-main-extra"><strong>Referência:</strong> {addressView.referencia}</p> : null}
              <p className="delivery-main-extra"><strong>Loja responsável:</strong> {data?.summary?.loja_nome || STORE_NAME}</p>
              <p className="delivery-main-extra"><strong>Resumo:</strong> {Number(data?.summary?.total_itens || 0)} item(ns) · R$ {Number(data?.summary?.total || 0).toFixed(2)}</p>
            </section>

            <section className="delivery-courier-card">
              <header>
                <h4>{data?.courier?.name || 'Entregador em definição'}</h4>
                <small>{data?.courier?.vehicle || 'Veículo em atualização'}</small>
              </header>
              <p>Status atual: <strong>{data?.status_label || 'Em andamento'}</strong></p>
              <p>Chegada prevista: <strong>{etaText}</strong></p>
              <p>{hasCourierLocation ? 'Localização do entregador atualizada.' : 'Localização do entregador em atualização.'}</p>

              {showTrackingFallback ? (
                <p className="delivery-main-extra">
                  O rastreio oficial ainda não foi liberado. Enquanto isso, nosso time acompanha sua entrega em tempo real.
                </p>
              ) : null}

              {data?.safety_pin ? (
                <div className={`delivery-pin-box ${shouldHighlightPin ? 'is-highlight' : ''}`.trim()}>
                  <p>Código de confirmação</p>
                  <strong>{showPin ? data.safety_pin : '······'}</strong>
                  <small>Informe este código somente ao receber seu pedido.</small>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!canRevealPin}
                    onClick={() => {
                      if (!canRevealPin) {
                        return;
                      }
                      const next = !showPin;
                      setShowPin(next);
                      if (next) {
                        void registerEvent('pin_revealed', { source: 'tracking_panel' });
                      }
                    }}
                  >
                    {canRevealPin ? (showPin ? 'Ocultar PIN' : 'Mostrar PIN') : 'Disponível quando sair para entrega'}
                  </button>
                </div>
              ) : null}

              <div className="delivery-actions-grid">
                {trackingUrl && !isCanceledStatus ? (
                  <a
                    className="btn-primary"
                    href={trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={trackingPrimaryLabel}
                    title={trackingPrimaryLabel}
                    onClick={() => { void registerEvent('open_tracking', { source: 'tracking_url' }); }}
                  >
                    {trackingPrimaryLabel}
                  </a>
                ) : null}

                {canTalkToCourier && !isCanceledStatus ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      void registerEvent('talk_to_courier', { channel: 'uber_official' });
                      window.open(trackingUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Fale com entregador
                  </button>
                ) : (
                  <p className="delivery-main-extra">Canal direto com entregador indisponível neste pedido. Fale com a loja para suporte imediato.</p>
                )}

                <a
                  className="btn-secondary"
                  href={STORE_WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => { void registerEvent('talk_to_store', { channel: 'whatsapp' }); }}
                >
                  Fale com a loja
                </a>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowHelp(true);
                    void registerEvent('open_help_center', { source: 'tracking_panel' });
                  }}
                >
                  Preciso de ajuda
                </button>

                <button type="button" className="btn-secondary" onClick={() => { void handleShareStatus(); }}>
                  Compartilhar status
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    void registerEvent('open_proof', { has_photo: Boolean(data?.proof?.photo_url), has_signature: Boolean(data?.proof?.signature_url) });
                    const proofUrl = data?.proof?.photo_url || data?.proof?.signature_url;
                    if (proofUrl) {
                      window.open(proofUrl, '_blank', 'noopener,noreferrer');
                    } else {
                      window.alert('Ainda não há prova de entrega disponível para este pedido.');
                    }
                  }}
                >
                  Ver prova de entrega
                </button>
              </div>
            </section>

            <section className="delivery-recipient-box">
              <h4>Outra pessoa vai receber?</h4>
              <p>Você pode deixar o nome e uma observação para ajudar a entrega.</p>
              <div className="delivery-recipient-grid">
                <input
                  className="field-input"
                  type="text"
                  placeholder="Nome de quem recebe"
                  value={receiverName}
                  onChange={(event) => setReceiverName(event.target.value)}
                  maxLength={120}
                />
                <input
                  className="field-input"
                  type="text"
                  placeholder="Observação rápida (ex: portaria)"
                  value={receiverNote}
                  onChange={(event) => setReceiverNote(event.target.value)}
                  maxLength={255}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={savingReceiver}
                  onClick={() => { void handleSaveReceiver(); }}
                >
                  {savingReceiver ? 'Salvando...' : 'Salvar recebimento'}
                </button>
              </div>
            </section>

            <section className="delivery-timeline-card">
              <h4>Linha do tempo da entrega</h4>
              <DeliveryTimeline timeline={data?.timeline || []} statusInternal={statusInternal} />
            </section>

            <section className="delivery-footer-actions">
              {!isFinalStatus ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    void registerEvent('confirm_address', { source: 'tracking_panel' });
                    window.alert('Endereço confirmado no acompanhamento. Se precisar alterar, fale com a loja.');
                  }}
                >
                  Confirmar endereço
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (typeof onRepeatOrder === 'function') {
                    onRepeatOrder();
                  }
                }}
              >
                Repetir pedido
              </button>
              <a className="btn-secondary" href={STORE_WHATSAPP_URL} target="_blank" rel="noreferrer">
                Preciso de ajuda agora
              </a>
              <small>
                Atendimento da loja: {STORE_TELEFONE_DISPLAY}
                {pedidoResumo?.status === 'entregue' ? ' · Entrega concluída.' : ''}
              </small>
            </section>
          </>
        ) : null}
      </aside>

      <DeliveryHelpModal
        open={showHelp}
        onClose={() => setShowHelp(false)}
        pedidoId={pedidoId}
        onRegisterEvent={registerEvent}
        provider={provider}
        trackingUrl={trackingUrl}
      />
    </div>
  );
}
