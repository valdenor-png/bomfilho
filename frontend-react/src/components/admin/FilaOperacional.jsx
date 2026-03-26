import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BadgeX, CircleCheck, ClipboardList, Clock3, Package, RefreshCw, Search, Store, Truck, Wallet, X } from 'lucide-react';
import {
  adminGetFilaOperacional,
  adminGetPedidoDetalhes,
  adminAtualizarStatusPedido,
  adminAprovarRevisao,
  adminRejeitarRevisao,
  adminListarEntregasUber,
  adminCriarEntregaUber,
  adminCancelarEntregaUber
} from '../../lib/api';
import LoadingSkeleton from './ui/LoadingSkeleton';

const R$ = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatarDataHora = (valor) => {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

async function copiarTexto(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return false;

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
  return true;
}

// Filas operacionais com labels atualizados
const LABELS_FILA = {
  aguardando_revisao: { titulo: 'Revisão — Confirmar Disponibilidade', cor: '#f97316', proximoStatus: null, btnLabel: null, btnClass: null, isRevisao: true },
  pagos_aguardando_preparo: { titulo: 'Pagos — Aguardando Separação', cor: '#3b82f6', proximoStatus: 'preparando', btnLabel: 'Separar Pedido', btnClass: 'btn-separar' },
  em_separacao: { titulo: 'Separando', cor: '#8b5cf6', proximoStatus: 'pronto_para_retirada', btnLabel: 'Marcar Preparado', btnClass: 'btn-preparado' },
  prontos_aguardando_saida: { titulo: 'Preparados — Despachar', cor: '#10b981', proximoStatus: 'enviado', btnLabel: 'Saiu pra Entrega', btnClass: 'btn-despachar' },
  em_rota: { titulo: 'Saiu pra Entrega', cor: '#f59e0b', proximoStatus: 'entregue', btnLabel: 'Confirmar Entrega', btnClass: 'btn-entregue' },
  em_rota_acima_sla: { titulo: 'Em Rota — Acima do SLA', cor: '#ef4444', proximoStatus: 'entregue', btnLabel: 'Confirmar Entrega', btnClass: 'btn-entregue' },
  retiradas_prontas_aguardando: { titulo: 'Retiradas — Avisar Cliente', cor: '#0891b2', proximoStatus: 'retirado', btnLabel: 'Marcar Retirado', btnClass: 'btn-retirado' },
  pendentes_pagamento: { titulo: 'Aguardando Pagamento', cor: '#9ca3af', proximoStatus: null, btnLabel: null, btnClass: null },
  travados: { titulo: 'Travados (+60min)', cor: '#6b7280', proximoStatus: null, btnLabel: null, btnClass: null }
};

const STATUS_DISPLAY = {
  aguardando_revisao: { label: 'Em Revisão', icon: ClipboardList, cor: '#f97316' },
  pendente: { label: 'Aguardando', icon: Clock3, cor: '#9ca3af' },
  pago: { label: 'Pago', icon: Wallet, cor: '#3b82f6' },
  preparando: { label: 'Separando', icon: Package, cor: '#8b5cf6' },
  pronto_para_retirada: { label: 'Preparado', icon: CircleCheck, cor: '#10b981' },
  enviado: { label: 'Saiu pra Entrega', icon: Truck, cor: '#f59e0b' },
  entregue: { label: 'Entregue', icon: CircleCheck, cor: '#22c55e' },
  retirado: { label: 'Retirado', icon: Store, cor: '#22c55e' },
  cancelado: { label: 'Cancelado', icon: BadgeX, cor: '#ef4444' }
};

function StatusBadge({ status }) {
  const meta = STATUS_DISPLAY[status] || { label: status, icon: Package, cor: '#6b7280' };
  const Icon = typeof meta.icon === 'function' ? meta.icon : Package;
  return (
    <span className="fila-status-badge" style={{ background: `${meta.cor}18`, color: meta.cor, borderColor: `${meta.cor}40` }}>
      <span aria-hidden="true"><Icon size={14} /></span> {meta.label}
    </span>
  );
}

function ProgressoEtapas({ status, tipoEntrega }) {
  const isRetirada = tipoEntrega === 'retirada';
  const etapas = isRetirada
    ? [{ key: 'pago', label: 'Pago' }, { key: 'preparando', label: 'Separando' }, { key: 'pronto_para_retirada', label: 'Preparado' }, { key: 'retirado', label: 'Retirado' }]
    : [{ key: 'pago', label: 'Pago' }, { key: 'preparando', label: 'Separando' }, { key: 'pronto_para_retirada', label: 'Preparado' }, { key: 'enviado', label: 'Em Entrega' }, { key: 'entregue', label: 'Entregue' }];

  const ordemStatus = etapas.map(e => e.key);
  const idxAtual = ordemStatus.indexOf(status);

  return (
    <div className="fila-progresso-etapas">
      {etapas.map((etapa, i) => {
        const done = i < idxAtual;
        const current = i === idxAtual;
        return (
          <div key={etapa.key} className={`fila-etapa ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}>
            <span className="fila-etapa-dot" />
            <span className="fila-etapa-label">{etapa.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function FilaPedidoCard({
  pedido,
  filaConfig,
  onAcao,
  onRevisao,
  atualizandoId,
  detalhesAbertos,
  detalhesCarregando,
  detalhesErro,
  detalhesData,
  onToggleDetalhes
}) {
  const minParado = Number(pedido.minutos_parado || pedido.minutos_rota || pedido.minutos_pendente || pedido.minutos_desde_criacao || 0);
  const urgente = minParado > 30;
  const critico = minParado > 60;
  const cliente = detalhesData?.cliente || null;
  const pedidoDetalhes = detalhesData?.pedido || null;
  const endereco = detalhesData?.endereco || null;
  const detalhesItens = Array.isArray(detalhesData?.itens) ? detalhesData.itens : [];
  const detalhesTotalItens = Number(detalhesData?.total_itens || 0);
  const detalhesTotalProdutos = Number(detalhesData?.total_produtos || 0);
  const enderecoTexto = endereco
    ? [
      String(endereco.logradouro || '').trim(),
      String(endereco.numero || '').trim(),
      String(endereco.complemento || '').trim(),
      String(endereco.bairro || '').trim(),
      String(endereco.cidade || '').trim(),
      String(endereco.estado || '').trim(),
      String(endereco.cep || '').trim()
    ].filter(Boolean).join(', ')
    : '';

  return (
    <div className={`fila-card ${critico ? 'is-critico' : urgente ? 'is-urgente' : ''}`}>
      <div className="fila-card-header">
        <span className="fila-card-id">#{pedido.id}</span>
        <span className="fila-card-tempo" title={`${minParado}min parado`}>
          <Clock3 size={12} aria-hidden="true" /> {minParado >= 60 ? `${Math.floor(minParado / 60)}h${minParado % 60}m` : `${minParado}min`}
        </span>
      </div>

      <div className="fila-card-info">
        <span className="fila-card-cliente">{pedido.cliente_nome || '—'}</span>
        <span className="fila-card-valor">{R$(pedido.total)}</span>
      </div>

      <div className="fila-card-meta">
        <span className="fila-card-tipo">
          {pedido.tipo_entrega === 'retirada'
            ? <><Store size={12} aria-hidden="true" /> Retirada</>
            : <><Truck size={12} aria-hidden="true" /> Entrega</>}
        </span>
        <StatusBadge status={pedido.status} />
      </div>

      <ProgressoEtapas status={pedido.status} tipoEntrega={pedido.tipo_entrega} />

      <div className={`fila-card-acoes ${filaConfig.isRevisao ? 'fila-card-acoes-revisao' : ''}`.trim()}>
        <button
          className="fila-btn-acao btn-detalhes-revisao"
          disabled={atualizandoId === pedido.id}
          onClick={() => onToggleDetalhes(pedido.id)}
        >
          {detalhesAbertos
            ? <><Search size={12} aria-hidden="true" /> Ocultar detalhes</>
            : <><Search size={12} aria-hidden="true" /> Detalhes</>}
        </button>

        {filaConfig.isRevisao ? (
          <>
          <button
            className="fila-btn-acao btn-aprovar-revisao"
            disabled={atualizandoId === pedido.id}
            onClick={() => onRevisao(pedido.id, 'aprovar')}
          >
            {atualizandoId === pedido.id ? 'Processando...' : <><CircleCheck size={12} aria-hidden="true" /> Aprovar</>}
          </button>
          <button
            className="fila-btn-acao btn-rejeitar-revisao"
            disabled={atualizandoId === pedido.id}
            onClick={() => onRevisao(pedido.id, 'rejeitar')}
          >
            <><BadgeX size={12} aria-hidden="true" /> Rejeitar</>
          </button>
          </>
        ) : null}

        {!filaConfig.isRevisao && filaConfig.proximoStatus ? (
          <>
          <button
            className={`fila-btn-acao ${filaConfig.btnClass || ''}`}
            disabled={atualizandoId === pedido.id}
            onClick={() => onAcao(pedido.id, filaConfig.proximoStatus)}
          >
            {atualizandoId === pedido.id ? 'Atualizando...' : filaConfig.btnLabel}
          </button>
          {/* Botão cancelar sempre disponível */}
          <button
            className="fila-btn-cancelar"
            disabled={atualizandoId === pedido.id}
            onClick={() => onAcao(pedido.id, 'cancelado')}
            title="Cancelar pedido"
          >
            <X size={12} aria-hidden="true" />
          </button>
          </>
        ) : null}
      </div>

      {detalhesAbertos ? (
        <div className="fila-revisao-detalhes" aria-live="polite">
          {detalhesCarregando ? (
            <p className="fila-revisao-detalhes-loading">Carregando detalhes do pedido...</p>
          ) : detalhesErro ? (
            <p className="fila-revisao-detalhes-erro">{detalhesErro}</p>
          ) : detalhesItens.length === 0 ? (
            <p className="fila-revisao-detalhes-vazio">Nenhum produto encontrado para este pedido.</p>
          ) : (
            <>
              <div className="fila-detalhes-grid">
                <div className="fila-detalhes-bloco">
                  <p className="fila-revisao-detalhes-head">Cliente</p>
                  <p className="fila-detalhes-linha"><strong>Nome:</strong> {cliente?.nome || pedido.cliente_nome || 'Não informado'}</p>
                  <p className="fila-detalhes-linha"><strong>Telefone:</strong> {cliente?.telefone || pedido.cliente_telefone || 'Não informado'}</p>
                  <p className="fila-detalhes-linha"><strong>Email:</strong> {cliente?.email || pedido.cliente_email || 'Não informado'}</p>
                </div>

                <div className="fila-detalhes-bloco">
                  <p className="fila-revisao-detalhes-head">Pedido</p>
                  <p className="fila-detalhes-linha"><strong>Forma pag.:</strong> {String(pedidoDetalhes?.forma_pagamento || pedido.forma_pagamento || '-')}</p>
                  <p className="fila-detalhes-linha"><strong>Entrega:</strong> {String(pedidoDetalhes?.tipo_entrega || pedido.tipo_entrega || '-')}</p>
                  <p className="fila-detalhes-linha"><strong>Total:</strong> {R$(pedidoDetalhes?.total || pedido.total)}</p>
                  {enderecoTexto ? <p className="fila-detalhes-linha"><strong>Endereço:</strong> {enderecoTexto}</p> : null}
                </div>
              </div>

              <p className="fila-revisao-detalhes-head">Carrinho ({detalhesTotalItens} itens)</p>
              <ul className="fila-revisao-itens-lista">
                {detalhesItens.map((item, index) => (
                  <li key={`${pedido.id}-item-${index}`} className="fila-revisao-item-row">
                    <span className="fila-revisao-item-qtd">{Number(item?.quantidade || 0)}x</span>
                    <span className="fila-revisao-item-nome">{String(item?.nome_produto || item?.nome || 'Item sem nome')}</span>
                    <span className="fila-revisao-item-subtotal">{R$(item?.subtotal)}</span>
                  </li>
                ))}
              </ul>
              <p className="fila-detalhes-total"><strong>Total produtos:</strong> {R$(detalhesTotalProdutos)}</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FilaGrupo({
  chave,
  pedidos,
  onAcao,
  onRevisao,
  atualizandoId,
  detalhesRevisaoAbertos,
  detalhesRevisaoCarregando,
  detalhesRevisaoPorPedido,
  onToggleDetalhesRevisao
}) {
  const cfg = LABELS_FILA[chave];
  if (!cfg || !pedidos || pedidos.length === 0) return null;

  return (
    <div className="fila-grupo">
      <div className="fila-grupo-header" style={{ borderLeftColor: cfg.cor }}>
        <span className="fila-grupo-titulo">{cfg.titulo}</span>
        <span className="fila-grupo-badge" style={{ background: cfg.cor }}>{pedidos.length}</span>
      </div>
      <div className="fila-grupo-cards">
        {pedidos.map(p => (
          <FilaPedidoCard
            key={p.id}
            pedido={p}
            filaConfig={cfg}
            onAcao={onAcao}
            onRevisao={onRevisao}
            atualizandoId={atualizandoId}
            detalhesAbertos={Boolean(detalhesRevisaoAbertos[p.id])}
            detalhesCarregando={Boolean(detalhesRevisaoCarregando[p.id])}
            detalhesErro={String(detalhesRevisaoPorPedido[p.id]?.erro || '')}
            detalhesData={detalhesRevisaoPorPedido[p.id] || null}
            onToggleDetalhes={onToggleDetalhesRevisao}
          />
        ))}
      </div>
    </div>
  );
}

export default function FilaOperacional() {
  const [dados, setDados] = useState(null);
  const [entregasUber, setEntregasUber] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [atualizandoId, setAtualizandoId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [detalhesRevisaoAbertos, setDetalhesRevisaoAbertos] = useState({});
  const [detalhesRevisaoCarregando, setDetalhesRevisaoCarregando] = useState({});
  const [detalhesRevisaoPorPedido, setDetalhesRevisaoPorPedido] = useState({});
  const [drawerPedidoId, setDrawerPedidoId] = useState(null);
  const intervaloRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const [respFila, respUber] = await Promise.all([
        adminGetFilaOperacional(),
        adminListarEntregasUber().catch(() => ({ pedidos: [] }))
      ]);
      const resp = respFila;
      setDados(resp);
      setEntregasUber(Array.isArray(respUber?.pedidos) ? respUber.pedidos : []);
      setErro(null);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar fila operacional');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [carregar]);

  useEffect(() => {
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    if (autoRefresh) {
      intervaloRef.current = setInterval(carregar, 30000);
    }
    return () => { if (intervaloRef.current) clearInterval(intervaloRef.current); };
  }, [autoRefresh, carregar]);

  const handleAcao = useCallback(async (pedidoId, novoStatus) => {
    if (novoStatus === 'cancelado') {
      if (!window.confirm(`Tem certeza que deseja cancelar o pedido #${pedidoId}?`)) return;
    }
    setAtualizandoId(pedidoId);
    try {
      await adminAtualizarStatusPedido(pedidoId, novoStatus);
      const labelStatus = STATUS_DISPLAY[novoStatus]?.label || novoStatus;
      setFeedback({ tipo: 'ok', msg: `Pedido #${pedidoId} → ${labelStatus}` });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: e.message || 'Erro ao atualizar status' });
    } finally {
      setAtualizandoId(null);
    }
  }, [carregar]);

  const handleChamarUber = useCallback(async (pedido) => {
    const pedidoId = Number(pedido?.id || 0);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return;
    }

    setAtualizandoId(pedidoId);
    try {
      await adminCriarEntregaUber({
        pedidoId,
        estimateId: pedido?.uber_estimate_id
      });
      setFeedback({ tipo: 'ok', msg: `Entrega Uber criada para pedido #${pedidoId}` });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: e.message || 'Falha ao chamar Uber' });
    } finally {
      setAtualizandoId(null);
    }
  }, [carregar]);

  const handleCancelarUber = useCallback(async (pedido) => {
    const pedidoId = Number(pedido?.id || 0);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return;
    }

    if (!window.confirm(`Cancelar entrega Uber do pedido #${pedidoId}?`)) {
      return;
    }

    setAtualizandoId(pedidoId);
    try {
      await adminCancelarEntregaUber({
        pedidoId,
        motivo: 'cancelamento_operacional_admin'
      });
      setFeedback({ tipo: 'ok', msg: `Entrega Uber cancelada no pedido #${pedidoId}` });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
      await carregar();
    } catch (e) {
      setFeedback({ tipo: 'erro', msg: e.message || 'Falha ao cancelar entrega Uber' });
    } finally {
      setAtualizandoId(null);
    }
  }, [carregar]);

  const handleRevisao = useCallback(async (pedidoId, acao) => {
    if (acao === 'rejeitar') {
      const motivo = window.prompt(`Motivo da rejeição do pedido #${pedidoId}:`);
      if (motivo === null) return; // cancelou prompt
      setAtualizandoId(pedidoId);
      try {
        await adminRejeitarRevisao(pedidoId, motivo || 'Produto(s) indisponível(is)');
        setFeedback({ tipo: 'ok', msg: `Pedido #${pedidoId} rejeitado — estoque restaurado` });
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
        await carregar();
      } catch (e) {
        setFeedback({ tipo: 'erro', msg: e.message || 'Erro ao rejeitar revisão' });
      } finally {
        setAtualizandoId(null);
      }
    } else {
      setAtualizandoId(pedidoId);
      try {
        await adminAprovarRevisao(pedidoId, '');
        setFeedback({ tipo: 'ok', msg: `Pedido #${pedidoId} aprovado — aguardando pagamento` });
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => setFeedback(null), 3000);
        await carregar();
      } catch (e) {
        setFeedback({ tipo: 'erro', msg: e.message || 'Erro ao aprovar revisão' });
      } finally {
        setAtualizandoId(null);
      }
    }
  }, [carregar]);

    const carregarDetalhesRevisaoPedido = useCallback(async (pedidoId) => {
    const id = Number(pedidoId || 0);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }

    if (detalhesRevisaoPorPedido[id] || detalhesRevisaoCarregando[id]) {
      return detalhesRevisaoPorPedido[id] || null;
    }

    setDetalhesRevisaoCarregando((atual) => ({ ...atual, [id]: true }));
    try {
      const data = await adminGetPedidoDetalhes(id);
      const payload = {
        ...data,
        erro: ''
      };
      setDetalhesRevisaoPorPedido((atual) => ({
        ...atual,
        [id]: payload
      }));
      return payload;
    } catch (e) {
      const payloadErro = {
        itens: [],
        totalItens: 0,
        erro: e.message || 'Nao foi possivel carregar os itens do pedido.'
      };
      setDetalhesRevisaoPorPedido((atual) => ({
        ...atual,
        [id]: payloadErro
      }));
      return payloadErro;
    } finally {
      setDetalhesRevisaoCarregando((atual) => {
        const proximo = { ...atual };
        delete proximo[id];
        return proximo;
      });
    }
  }, [detalhesRevisaoCarregando, detalhesRevisaoPorPedido]);

  const handleToggleDetalhesRevisao = useCallback(async (pedidoId) => {
    const id = Number(pedidoId || 0);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    const abrindo = !Boolean(detalhesRevisaoAbertos[id]);
    setDetalhesRevisaoAbertos((atual) => ({
      ...atual,
      [id]: abrindo
    }));

    if (!abrindo) {
      return;
    }

    setDrawerPedidoId(id);
    await carregarDetalhesRevisaoPedido(id);
  }, [carregarDetalhesRevisaoPedido, detalhesRevisaoAbertos]);

  const handleCopiarTelefoneDrawer = useCallback(async (telefone) => {
    const ok = await copiarTexto(telefone);
    if (ok) {
      setFeedback({ tipo: 'ok', msg: 'Telefone copiado.' });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2200);
    }
  }, []);

  const handleCopiarResumoDrawer = useCallback(async (pedidoDetalhesData) => {
    const pedidoInfo = pedidoDetalhesData?.pedido || {};
    const clienteInfo = pedidoDetalhesData?.cliente || {};
    const itensLista = Array.isArray(pedidoDetalhesData?.itens) ? pedidoDetalhesData.itens : [];
    const resumo = [
      `Pedido #${pedidoInfo?.id || drawerPedidoId || '-'}`,
      `Status: ${String(pedidoInfo?.status || '').toLowerCase() || '-'}`,
      `Cliente: ${String(clienteInfo?.nome || '').trim() || 'Nao informado'}`,
      `Telefone: ${String(clienteInfo?.telefone || '').trim() || 'Nao informado'}`,
      `Atendimento: ${String(pedidoInfo?.tipo_entrega || '').trim() || '-'}`,
      `Forma pagamento: ${String(pedidoInfo?.forma_pagamento || '').trim() || '-'}`,
      '',
      'Itens:'
    ];

    itensLista.forEach((item) => {
      resumo.push(`- ${Number(item?.quantidade || 0)}x ${String(item?.nome_produto || item?.nome || 'Item sem nome')} (${R$(item?.subtotal)})`);
    });

    resumo.push('');
    resumo.push(`Total: ${R$(pedidoInfo?.total || 0)}`);

    const ok = await copiarTexto(resumo.join('\n'));
    if (ok) {
      setFeedback({ tipo: 'ok', msg: 'Resumo do pedido copiado.' });
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 2200);
    }
  }, [drawerPedidoId]);

  const handleFecharDrawerDetalhes = useCallback(() => {
    setDrawerPedidoId(null);
  }, []);

  const drawerDetalhes = drawerPedidoId ? detalhesRevisaoPorPedido[drawerPedidoId] || null : null;
  const drawerCarregando = Boolean(drawerPedidoId && detalhesRevisaoCarregando[drawerPedidoId]);
  const drawerErro = String(drawerDetalhes?.erro || '');
  const drawerPedido = drawerDetalhes?.pedido || null;
  const drawerCliente = drawerDetalhes?.cliente || null;
  const drawerEndereco = drawerDetalhes?.endereco || null;
  const drawerItens = Array.isArray(drawerDetalhes?.itens) ? drawerDetalhes.itens : [];
  const drawerWhatsapp = String(drawerCliente?.telefone || '').replace(/\D/g, '');
  const enderecoDrawerTexto = drawerEndereco
    ? [
      String(drawerEndereco.logradouro || '').trim(),
      String(drawerEndereco.numero || '').trim(),
      String(drawerEndereco.complemento || '').trim(),
      String(drawerEndereco.bairro || '').trim(),
      String(drawerEndereco.cidade || '').trim(),
      String(drawerEndereco.estado || '').trim(),
      String(drawerEndereco.cep || '').trim()
    ].filter(Boolean).join(', ')
    : '';

  if (carregando) return <LoadingSkeleton type="cards" lines={4} />;
  if (erro) return <div className="fila-erro">{erro} <button onClick={carregar}>Tentar novamente</button></div>;
  if (!dados) return null;

  const totalAlertas = Object.values(dados.contadores || {}).reduce((s, v) => s + v, 0);
  const ordemFilas = [
    'aguardando_revisao',
    'pagos_aguardando_preparo',
    'em_separacao',
    'prontos_aguardando_saida',
    'em_rota',
    'em_rota_acima_sla',
    'retiradas_prontas_aguardando',
    'pendentes_pagamento',
    'travados'
  ];

  return (
    <div className="fila-operacional">
      <div className="fila-header">
        <h2 className="fila-titulo">
          <Package size={18} aria-hidden="true" /> Fila Operacional
          {totalAlertas > 0 && <span className="fila-total-badge">{totalAlertas} ações</span>}
        </h2>
        <div className="fila-controles">
          <label className="fila-auto-refresh">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            Auto-refresh 30s
          </label>
          <button className="fila-btn-refresh" onClick={carregar}><RefreshCw size={12} aria-hidden="true" /> Atualizar</button>
        </div>
      </div>

      {feedback && (
        <div className={`fila-feedback is-${feedback.tipo}`}>{feedback.msg}</div>
      )}

      {/* Contadores rápidos */}
      <div className="fila-contadores">
        {Object.entries(dados.contadores || {}).map(([k, v]) => {
          const cfg = LABELS_FILA[k];
          if (!cfg) return null;
          return (
            <div key={k} className="fila-contador" style={{ borderLeftColor: cfg.cor }}>
              <span className="fila-contador-valor" style={{ color: v > 0 ? cfg.cor : '#6b7280' }}>{v}</span>
              <span className="fila-contador-label">{cfg.titulo.replace(/^[^\s]+\s/, '')}</span>
            </div>
          );
        })}
      </div>

      {totalAlertas === 0 && (
        <div className="fila-vazia"><CircleCheck size={14} aria-hidden="true" /> Nenhum pedido pendente de ação. Operação em dia!</div>
      )}

      {/* Filas por prioridade */}
      <div className="fila-grupos">
        {ordemFilas.map(chave => (
          <FilaGrupo
            key={chave}
            chave={chave}
            pedidos={dados[chave]}
            onAcao={handleAcao}
            onRevisao={handleRevisao}
            atualizandoId={atualizandoId}
            detalhesRevisaoAbertos={detalhesRevisaoAbertos}
            detalhesRevisaoCarregando={detalhesRevisaoCarregando}
            detalhesRevisaoPorPedido={detalhesRevisaoPorPedido}
            onToggleDetalhesRevisao={handleToggleDetalhesRevisao}
          />
        ))}
      </div>

      <div className="fila-grupo" style={{ marginTop: 16 }}>
        <div className="fila-grupo-header" style={{ borderLeftColor: '#111827' }}>
          <span className="fila-grupo-titulo"><Truck size={14} aria-hidden="true" /> Uber Direct — Operação de Entrega</span>
          <span className="fila-grupo-badge" style={{ background: '#111827' }}>{entregasUber.length}</span>
        </div>

        {entregasUber.length === 0 ? (
          <div className="fila-vazia">Sem pedidos de entrega para Uber no momento.</div>
        ) : (
          <div className="fila-grupo-cards">
            {entregasUber.map((pedido) => {
              const emEnvio = String(pedido?.status || '').toLowerCase() === 'enviado';
              const possuiEntrega = Boolean(String(pedido?.uber_delivery_id || '').trim());
              const freteCliente = Number(pedido?.frete_cobrado_cliente || 0);
              const freteUber = Number(pedido?.frete_real_uber || 0);
              const margem = Number(pedido?.margem_pedido || 0);

              return (
                <article key={`uber-${pedido.id}`} className="fila-card">
                  <div className="fila-card-header">
                    <span className="fila-card-id">#{pedido.id}</span>
                    <span className="fila-card-tempo">{pedido?.entrega_status || 'pendente'}</span>
                  </div>
                  <div className="fila-card-info">
                    <span className="fila-card-cliente">{pedido?.cliente_nome || '—'}</span>
                    <span className="fila-card-valor">{R$(pedido?.total)}</span>
                  </div>
                  <div className="fila-card-meta" style={{ display: 'grid', gap: 4 }}>
                    <span>Frete cliente: <strong>{R$(freteCliente)}</strong></span>
                    <span>Frete Uber: <strong>{freteUber > 0 ? R$(freteUber) : '—'}</strong></span>
                    <span>Margem: <strong>{R$(margem)}</strong></span>
                    {pedido?.uber_vehicle_type ? <span>Veículo: <strong>{String(pedido.uber_vehicle_type).toUpperCase()}</strong></span> : null}
                  </div>
                  <div className="fila-card-acoes" style={{ marginTop: 10 }}>
                    {!possuiEntrega ? (
                      <button
                        className="fila-btn-acao btn-despachar"
                        disabled={atualizandoId === pedido.id}
                        onClick={() => handleChamarUber(pedido)}
                      >
                        {atualizandoId === pedido.id ? 'Chamando...' : <><Truck size={12} aria-hidden="true" /> Chamar Uber</>}
                      </button>
                    ) : null}

                    {possuiEntrega ? (
                      <>
                        {pedido?.uber_tracking_url ? (
                          <a className="fila-btn-acao btn-separar" href={pedido.uber_tracking_url} target="_blank" rel="noreferrer">
                            <Search size={12} aria-hidden="true" /> Rastreio
                          </a>
                        ) : null}
                        {emEnvio ? (
                          <button
                            className="fila-btn-cancelar"
                            disabled={atualizandoId === pedido.id}
                            onClick={() => handleCancelarUber(pedido)}
                            title="Cancelar entrega Uber"
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {drawerPedidoId ? (
        <div className="fila-drawer-overlay" role="dialog" aria-modal="true" onClick={handleFecharDrawerDetalhes}>
          <aside className="fila-drawer" onClick={(event) => event.stopPropagation()}>
            <header className="fila-drawer-header">
              <div>
                <p className="fila-drawer-kicker">Detalhes operacionais</p>
                <h3>Pedido #{drawerPedidoId}</h3>
              </div>
              <button className="fila-drawer-close" type="button" onClick={handleFecharDrawerDetalhes}>
                X
              </button>
            </header>

            {drawerCarregando ? (
              <p className="fila-drawer-loading">Carregando detalhes completos...</p>
            ) : drawerErro ? (
              <p className="fila-drawer-error">{drawerErro}</p>
            ) : (
              <div className="fila-drawer-body">
                <div className="fila-drawer-grid">
                  <article className="fila-drawer-card">
                    <h4>Cliente</h4>
                    <p><strong>Nome:</strong> {String(drawerCliente?.nome || 'Nao informado')}</p>
                    <p><strong>Telefone:</strong> {String(drawerCliente?.telefone || 'Nao informado')}</p>
                    <p><strong>Email:</strong> {String(drawerCliente?.email || 'Nao informado')}</p>
                    <div className="fila-drawer-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => { void handleCopiarTelefoneDrawer(drawerCliente?.telefone); }}
                        disabled={!drawerCliente?.telefone}
                      >
                        Copiar telefone
                      </button>
                      {drawerWhatsapp ? (
                        <a className="btn-secondary" href={`https://wa.me/55${drawerWhatsapp}`} target="_blank" rel="noreferrer">
                          Abrir WhatsApp
                        </a>
                      ) : null}
                    </div>
                  </article>

                  <article className="fila-drawer-card">
                    <h4>Pedido</h4>
                    <p><strong>Status:</strong> {String(drawerPedido?.status || '-')}</p>
                    <p><strong>Forma pagamento:</strong> {String(drawerPedido?.forma_pagamento || '-')}</p>
                    <p><strong>Atendimento:</strong> {String(drawerPedido?.tipo_entrega || '-')}</p>
                    <p><strong>Criado em:</strong> {formatarDataHora(drawerPedido?.criado_em)}</p>
                    {String(drawerPedido?.tipo_entrega || '').toLowerCase() === 'entrega' ? (
                      <p><strong>Endereco:</strong> {enderecoDrawerTexto || 'Nao informado'}</p>
                    ) : (
                      <p><strong>Endereco:</strong> Retirada na loja</p>
                    )}
                  </article>
                </div>

                <article className="fila-drawer-card">
                  <h4>Itens ({Number(drawerDetalhes?.total_itens || 0)})</h4>
                  {drawerItens.length === 0 ? (
                    <p className="fila-drawer-empty">Nenhum item disponível neste pedido.</p>
                  ) : (
                    <ul className="fila-drawer-itens">
                      {drawerItens.map((item, index) => (
                        <li key={`drawer-item-${drawerPedidoId}-${index}`}>
                          <span>{Number(item?.quantidade || 0)}x {String(item?.nome_produto || item?.nome || 'Item sem nome')}</span>
                          <strong>{R$(item?.subtotal)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="fila-drawer-total">
                    <span>Subtotal: {R$(drawerDetalhes?.total_produtos || 0)}</span>
                    <span>Frete: {R$(drawerPedido?.frete_entrega || 0)}</span>
                    <span>Taxa servico: {R$(drawerPedido?.taxa_servico || 0)}</span>
                    <strong>Total: {R$(drawerPedido?.total || 0)}</strong>
                  </div>
                </article>

                <article className="fila-drawer-card">
                  <h4>Timeline</h4>
                  <ul className="fila-drawer-timeline">
                    <li>
                      <span>Pedido recebido</span>
                      <small>{formatarDataHora(drawerPedido?.criado_em)}</small>
                    </li>
                    <li>
                      <span>Status atual: {String(drawerPedido?.status || '-')}</span>
                      <small>{String(drawerPedido?.status || '').toLowerCase() === 'aguardando_revisao' ? 'Aguardando decisao da equipe' : 'Em andamento'}</small>
                    </li>
                  </ul>
                </article>

                <div className="fila-drawer-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => { void handleCopiarResumoDrawer(drawerDetalhes); }}
                  >
                    Copiar resumo
                  </button>
                  {String(drawerPedido?.status || '').toLowerCase() === 'aguardando_revisao' ? (
                    <>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={atualizandoId === drawerPedidoId}
                        onClick={() => { void handleRevisao(drawerPedidoId, 'aprovar'); }}
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={atualizandoId === drawerPedidoId}
                        onClick={() => { void handleRevisao(drawerPedidoId, 'rejeitar'); }}
                      >
                        Rejeitar
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
