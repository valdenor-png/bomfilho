import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useDocumentHead from '../hooks/useDocumentHead';
import { useCart } from '../context/CartContext';
import { useRecorrencia } from '../context/RecorrenciaContext';
import { getPedidoById, getPedidos, getPedidoStatus, confirmarRecebimentoPedido, isAuthErrorMessage } from '../lib/api';
import DeliveryTrackingPanel from '../components/pedidos/DeliveryTrackingPanel';
import InternalTopBar from '../components/navigation/InternalTopBar';

const PEDIDOS_POR_PAGINA = 20;
const PRELOAD_RESUMO_LIMITE = 6;

const FILTROS_STATUS = [
  { id: 'todos', label: 'Todos' },
  { id: 'andamento', label: 'Em andamento' },
  { id: 'entregues', label: 'Entregues' },
  { id: 'cancelados', label: 'Cancelados' }
];

const TIMELINE_ETAPAS = ['Recebido', 'Pago', 'Separando', 'Preparado', 'Entregue'];

const STATUS_PEDIDO_META = {
  pendente: {
    label: 'Aguardando confirmação',
    icon: '⏳',
    tone: 'waiting',
    timelineStep: 1
  },
  pago: {
    label: 'Pago',
    icon: '💳',
    tone: 'processing',
    timelineStep: 2
  },
  preparando: {
    label: 'Separando',
    icon: '📦',
    tone: 'preparing',
    timelineStep: 3
  },
  pronto_para_retirada: {
    label: 'Preparado',
    icon: '✅',
    tone: 'ready',
    timelineStep: 4
  },
  enviado: {
    label: 'Saiu pra Entrega',
    icon: '🛵',
    tone: 'delivery',
    timelineStep: 4
  },
  entregue: {
    label: 'Entregue',
    icon: '🏁',
    tone: 'delivered',
    timelineStep: 5
  },
  retirado: {
    label: 'Retirado',
    icon: '👋',
    tone: 'delivered',
    timelineStep: 5
  },
  cancelado: {
    label: 'Cancelado',
    icon: '⛔',
    tone: 'canceled',
    timelineStep: -1
  }
};

const FORMA_PAGAMENTO_LABELS = {
  pix: 'PIX',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro'
};

function obterMetaStatusPedido(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_PEDIDO_META[status] || {
    label: 'Em análise',
    icon: '🧾',
    tone: 'neutral',
    timelineStep: 1
  };
}

function obterGrupoStatus(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();

  if (status === 'cancelado') {
    return 'cancelados';
  }

  if (status === 'entregue') {
    return 'entregues';
  }

  return 'andamento';
}

function formatarFormaPagamento(formaRaw) {
  const forma = String(formaRaw || '').trim().toLowerCase();
  return FORMA_PAGAMENTO_LABELS[forma] || 'Não informado';
}

function formatarDataPedido(dataRaw, withHours = false) {
  if (!dataRaw) {
    return '-';
  }

  const data = new Date(dataRaw);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  if (!withHours) {
    return data.toLocaleDateString('pt-BR');
  }

  const dia = data.toLocaleDateString('pt-BR');
  const hora = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `${dia} às ${hora}`;
}

function montarResumoItens(itens) {
  const itensLista = Array.isArray(itens) ? itens : [];
  if (!itensLista.length) {
    return {
      totalItens: 0,
      resumoTexto: 'Nenhum item registrado para este pedido.'
    };
  }

  const totalItens = itensLista.reduce((acumulado, item) => {
    const quantidade = Number(item?.quantidade || 0);
    return acumulado + (Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1);
  }, 0);

  const nomes = itensLista
    .map((item) => String(item?.nome_produto || item?.nome || '').trim())
    .filter(Boolean);

  const nomesUnicos = [...new Set(nomes)];
  const preview = nomesUnicos.slice(0, 3);
  const extras = Math.max(0, nomesUnicos.length - preview.length);

  const resumoTexto = preview.length
    ? `${preview.join(', ')}${extras > 0 ? ` +${extras} item${extras > 1 ? 's' : ''}` : ''}`
    : 'Resumo dos itens disponível ao abrir detalhes.';

  return {
    totalItens,
    resumoTexto
  };
}

function OrderStatusBadge({ status }) {
  const meta = obterMetaStatusPedido(status);

  return (
    <span className={`orders-status-badge tone-${meta.tone}`}>
      <span className="orders-status-icon" aria-hidden="true">{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
}

function OrderTimeline({ status, compact = false }) {
  const meta = obterMetaStatusPedido(status);

  if (meta.tone === 'canceled') {
    return (
      <div className={`orders-timeline ${compact ? 'is-compact' : ''} is-canceled`}>
        <span className="orders-timeline-canceled-text">Pedido cancelado.</span>
      </div>
    );
  }

  return (
    <div className={`orders-timeline ${compact ? 'is-compact' : ''}`} aria-label="Andamento do pedido">
      {TIMELINE_ETAPAS.map((etapa, index) => {
        const numeroEtapa = index + 1;
        const done = numeroEtapa < meta.timelineStep;
        const current = numeroEtapa === meta.timelineStep;

        return (
          <div
            className={`orders-timeline-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
            key={`${meta.tone}-${etapa}`}
          >
            <span className="orders-timeline-dot" aria-hidden="true" />
            <span className="orders-timeline-label">{etapa}</span>
          </div>
        );
      })}
    </div>
  );
}

function OrdersSkeletonList() {
  return (
    <div className="orders-skeleton-list" aria-hidden="true">
      {[1, 2, 3].map((item) => (
        <article className="orders-skeleton-card" key={`orders-skeleton-${item}`}>
          <span className="orders-skeleton-line is-long" />
          <span className="orders-skeleton-line" />
          <span className="orders-skeleton-line is-medium" />
          <span className="orders-skeleton-line is-short" />
        </article>
      ))}
    </div>
  );
}

export default function PedidosPage() {
  useDocumentHead({ title: 'Meus Pedidos', description: 'Acompanhe seus pedidos, histórico e status de entrega.' });
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem } = useCart();
  const { registrarRecompraItens, registrarAcaoCarrinho } = useRecorrencia();
  const [pedidos, setPedidos] = useState([]);
  const [pedidoAbertoId, setPedidoAbertoId] = useState(null);
  const [detalhesPorPedido, setDetalhesPorPedido] = useState({});
  const [detalhesEmCarregamento, setDetalhesEmCarregamento] = useState({});
  const [carregando, setCarregando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [pedidoRepetindoId, setPedidoRepetindoId] = useState(null);
  const [confirmandoRecebimento, setConfirmandoRecebimento] = useState(null);
  const [trackingPedidoId, setTrackingPedidoId] = useState(null);
  const [autenticado, setAutenticado] = useState(null);
  const [erro, setErro] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPedidos, setTotalPedidos] = useState(0);
  const [temMaisPedidos, setTemMaisPedidos] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [buscaPedido, setBuscaPedido] = useState('');
  const [pedidoPagoAgoraId, setPedidoPagoAgoraId] = useState(null);

  const pedidoRecemPagoIdDaRota = useMemo(() => {
    const id = Number(location.state?.pedidoRecemPagoId || 0);
    return Number.isInteger(id) && id > 0 ? id : null;
  }, [location.state]);

  async function carregarPedidosIniciais() {
    setCarregando(true);
    setErro('');

    try {
      const data = await getPedidos({
        page: 1,
        limit: PEDIDOS_POR_PAGINA
      });

      const pedidosLista = Array.isArray(data?.pedidos) ? data.pedidos : [];
      setPedidos(pedidosLista);
      setPaginaAtual(Number(data?.paginacao?.pagina || 1));
      setTotalPedidos(Number(data?.paginacao?.total || pedidosLista.length));
      setTemMaisPedidos(Boolean(data?.paginacao?.tem_mais));
      setAutenticado(true);
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
        setPedidos([]);
      } else {
        setErro(error.message || 'Não foi possível carregar o histórico de pedidos.');
      }
    } finally {
      setCarregando(false);
    }
  }

  const carregarDetalhesPedido = useCallback(async (pedidoId, { silencioso = false } = {}) => {
    // Reusa cache local de detalhes para evitar chamadas repetidas ao abrir/fechar card.
    const id = Number(pedidoId);
    if (!Number.isInteger(id) || id <= 0) {
      return null;
    }

    const cache = detalhesPorPedido[id];
    if (cache && !cache.erro) {
      return cache;
    }

    if (detalhesEmCarregamento[id]) {
      return cache || null;
    }

    setDetalhesEmCarregamento((atual) => ({
      ...atual,
      [id]: true
    }));

    try {
      const data = await getPedidoById(id);
      const itens = Array.isArray(data?.itens) ? data.itens : [];
      const resumo = montarResumoItens(itens);

      const payload = {
        itens,
        erro: '',
        totalItens: resumo.totalItens,
        resumoTexto: resumo.resumoTexto
      };

      setDetalhesPorPedido((atual) => ({
        ...atual,
        [id]: payload
      }));

      return payload;
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
        setPedidoAbertoId(null);
        return null;
      }

      const payloadErro = {
        itens: [],
        erro: error.message || 'Não foi possível carregar os itens deste pedido.',
        totalItens: null,
        resumoTexto: 'Resumo indisponível no momento.'
      };

      setDetalhesPorPedido((atual) => ({
        ...atual,
        [id]: payloadErro
      }));

      if (!silencioso) {
        setErro(payloadErro.erro);
      }

      return payloadErro;
    } finally {
      setDetalhesEmCarregamento((atual) => {
        const proximo = { ...atual };
        delete proximo[id];
        return proximo;
      });
    }
  }, [detalhesEmCarregamento, detalhesPorPedido]);

  useEffect(() => {
    void carregarPedidosIniciais();
  }, []);

  useEffect(() => {
    if (!pedidoRecemPagoIdDaRota) {
      return;
    }

    setPedidoPagoAgoraId(pedidoRecemPagoIdDaRota);
    setFiltroStatus('todos');
    setBuscaPedido('');
    setPedidoAbertoId(pedidoRecemPagoIdDaRota);
    void carregarDetalhesPedido(pedidoRecemPagoIdDaRota, { silencioso: true });

    navigate(location.pathname, { replace: true, state: {} });
  }, [carregarDetalhesPedido, location.pathname, navigate, pedidoRecemPagoIdDaRota]);

  // Polling automático: atualiza status de pedidos ativos a cada 20s
  useEffect(() => {
    if (autenticado !== true || pedidos.length === 0) return;

    const statusAtivos = ['pendente', 'pago', 'preparando', 'pronto_para_retirada', 'enviado'];
    const pedidosAtivos = pedidos.filter(p => statusAtivos.includes(p?.status));
    if (pedidosAtivos.length === 0) return;

    const intervalo = setInterval(async () => {
      try {
        for (const pedido of pedidosAtivos) {
          const statusData = await getPedidoStatus(pedido.id);
          if (statusData && statusData.status !== pedido.status) {
            setPedidos(atuais => atuais.map(p =>
              p.id === pedido.id ? { ...p, status: statusData.status, atualizado_em: statusData.atualizado_em } : p
            ));
          }
        }
      } catch (_) { /* silencioso */ }
    }, 20000);

    return () => clearInterval(intervalo);
  }, [autenticado, pedidos]);

  async function handleConfirmarRecebimento(pedidoId) {
    setConfirmandoRecebimento(pedidoId);
    try {
      await confirmarRecebimentoPedido(pedidoId);
      setPedidos(atuais => atuais.map(p =>
        p.id === pedidoId ? { ...p, status: 'entregue' } : p
      ));
      setMensagemSucesso(`Recebimento do pedido #${pedidoId} confirmado!`);
    } catch (error) {
      setErro(error.message || 'Não foi possível confirmar o recebimento.');
    } finally {
      setConfirmandoRecebimento(null);
    }
  }

  useEffect(() => {
    if (autenticado !== true || pedidos.length === 0) {
      return;
    }

    const idsPreload = pedidos
      .slice(0, PRELOAD_RESUMO_LIMITE)
      .map((pedido) => Number(pedido?.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    idsPreload.forEach((id) => {
      if (!detalhesPorPedido[id] && !detalhesEmCarregamento[id]) {
        void carregarDetalhesPedido(id, { silencioso: true });
      }
    });
  }, [autenticado, pedidos, detalhesPorPedido, detalhesEmCarregamento, carregarDetalhesPedido]);

  async function carregarMaisPedidos() {
    if (carregando || carregandoMais || !temMaisPedidos) {
      return;
    }

    setCarregandoMais(true);
    setErro('');
    try {
      const proximaPagina = paginaAtual + 1;
      const data = await getPedidos({
        page: proximaPagina,
        limit: PEDIDOS_POR_PAGINA
      });

      const novosPedidos = Array.isArray(data.pedidos) ? data.pedidos : [];
      setPedidos((atuais) => {
        const mapa = new Map(atuais.map((pedido) => [String(pedido.id), pedido]));
        novosPedidos.forEach((pedido) => {
          mapa.set(String(pedido.id), pedido);
        });
        return Array.from(mapa.values());
      });

      setPaginaAtual(Number(data?.paginacao?.pagina || proximaPagina));
      setTotalPedidos((atual) => Number(data?.paginacao?.total || atual));
      setTemMaisPedidos(Boolean(data?.paginacao?.tem_mais));
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
        return;
      }

      setErro(error.message || 'Não foi possível carregar mais pedidos.');
    } finally {
      setCarregandoMais(false);
    }
  }

  async function handleToggleDetalhesPedido(pedidoId) {
    setMensagemSucesso('');

    if (pedidoAbertoId === pedidoId) {
      setPedidoAbertoId(null);
      return;
    }

    setPedidoAbertoId(pedidoId);
    await carregarDetalhesPedido(pedidoId);
  }

  async function handlePedirNovamente(pedido) {
    // Replica os itens do pedido anterior direto no carrinho atual.
    const pedidoId = Number(pedido?.id);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return;
    }

    setErro('');
    setMensagemSucesso('');
    setPedidoRepetindoId(pedidoId);

    try {
      const detalhes = await carregarDetalhesPedido(pedidoId);
      if (!detalhes || detalhes.erro || !Array.isArray(detalhes.itens) || detalhes.itens.length === 0) {
        setErro('Não foi possível repetir este pedido porque os itens não estão disponíveis no momento.');
        return;
      }

      let itensAdicionados = 0;
      let itensIgnorados = 0;

      detalhes.itens.forEach((item) => {
        const produtoId = Number(item?.produto_id || 0);
        if (!Number.isInteger(produtoId) || produtoId <= 0) {
          itensIgnorados += 1;
          return;
        }

        const quantidade = Math.max(1, Number(item?.quantidade || 1));
        const produtoRecompra = {
          id: produtoId,
          nome: String(item?.nome_produto || item?.nome || 'Item'),
          preco: Number(item?.preco || 0),
          emoji: String(item?.emoji || '📦'),
          categoria: String(item?.categoria || ''),
          imagem: String(item?.imagem || ''),
          unidade: String(item?.unidade || ''),
          marca: String(item?.marca || ''),
          descricao: String(item?.descricao || '')
        };

        addItem(
          produtoRecompra,
          quantidade
        );
        registrarAcaoCarrinho(produtoRecompra, { quantidade });
        itensAdicionados += quantidade;
      });

      registrarRecompraItens(detalhes.itens);

      if (itensAdicionados <= 0) {
        setErro('Não foi possível repetir este pedido porque os produtos não foram encontrados.');
        return;
      }

      if (itensIgnorados > 0) {
        setMensagemSucesso(`Pedido #${pedidoId} repetido com ${itensAdicionados} item(ns). ${itensIgnorados} item(ns) indisponível(is) não foi(ram) adicionado(s).`);
      } else {
        setMensagemSucesso(`Pedido #${pedidoId} adicionado ao carrinho com ${itensAdicionados} item(ns).`);
      }
    } finally {
      setPedidoRepetindoId(null);
    }
  }

  const pedidosFiltrados = useMemo(() => {
    const termo = String(buscaPedido || '').replace(/\D/g, '');

    return pedidos.filter((pedido) => {
      const grupo = obterGrupoStatus(pedido?.status);
      if (filtroStatus !== 'todos' && grupo !== filtroStatus) {
        return false;
      }

      if (termo && !String(pedido?.id || '').includes(termo)) {
        return false;
      }

      return true;
    });
  }, [buscaPedido, filtroStatus, pedidos]);

  const pedidosFiltradosOrdenados = useMemo(() => {
    if (!pedidoPagoAgoraId) {
      return pedidosFiltrados;
    }

    return [...pedidosFiltrados].sort((a, b) => {
      const aPagoAgora = Number(a?.id) === Number(pedidoPagoAgoraId);
      const bPagoAgora = Number(b?.id) === Number(pedidoPagoAgoraId);

      if (aPagoAgora === bPagoAgora) {
        return 0;
      }

      return aPagoAgora ? -1 : 1;
    });
  }, [pedidoPagoAgoraId, pedidosFiltrados]);

  const pedidoMaisRecenteId = Number(pedidos?.[0]?.id || 0) || null;
  const totalFiltrados = pedidosFiltradosOrdenados.length;
  const contadorPedidosTexto = totalPedidos > 0
    ? `${totalFiltrados} de ${totalPedidos} pedido(s)`
    : `${totalFiltrados} pedido(s)`;
  const mostrarEstadoErro = Boolean(erro) && !carregando && autenticado !== false && pedidos.length === 0;

  if (autenticado === false) {
    return (
      <section className="page orders-page">
        <InternalTopBar
          title="Pedidos"
          subtitle="Acompanhe seus pedidos em um único lugar"
          showBack={false}
          fallbackTo="/"
          backLabel="Voltar para início"
        />

        <div className="orders-state-card">
          <div className="orders-empty-icon" aria-hidden="true">🔐</div>
          <p><strong>Sua sessão não está ativa.</strong></p>
          <p>Faça login para acompanhar seus pedidos, detalhes e atualizações de entrega.</p>
          <Link to="/conta" className="btn-primary" style={{ display: 'inline-block' }}>
            Entrar na conta
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page orders-page">
      <InternalTopBar
        title="Pedidos"
        subtitle="Acompanhe o andamento de cada compra"
        showBack={false}
        fallbackTo="/"
        backLabel="Voltar para início"
      />

      <header className="orders-header">
        <div>
          <p className="orders-subtitle">Histórico recente com status em tempo real.</p>
        </div>

        <div className="orders-counter" aria-label="Resumo de pedidos">
          <strong>{contadorPedidosTexto}</strong>
        </div>
      </header>

      <section className="orders-toolbar" aria-label="Filtros de pedidos">
        <div className="orders-filters-row" role="tablist" aria-label="Filtrar por status">
          {FILTROS_STATUS.map((filtro) => (
            <button
              key={filtro.id}
              type="button"
              className={`orders-filter-btn ${filtroStatus === filtro.id ? 'active' : ''}`}
              onClick={() => setFiltroStatus(filtro.id)}
            >
              {filtro.label}
            </button>
          ))}
        </div>

        <label className="orders-search-wrap" htmlFor="orders-search-id">
          <span className="orders-search-label">Buscar pedido</span>
          <input
            id="orders-search-id"
            className="field-input orders-search-input"
            type="search"
            value={buscaPedido}
            onChange={(event) => setBuscaPedido(event.target.value)}
            placeholder="Ex.: #128"
            inputMode="numeric"
          />
        </label>
      </section>

      {pedidoPagoAgoraId ? (
        <div className="orders-feedback is-success" role="status" aria-live="polite">
          <p>Pagamento confirmado. Pedido #{pedidoPagoAgoraId} já está disponível para acompanhamento.</p>
        </div>
      ) : null}

      {erro ? <p className="error-text" role="alert">{erro}</p> : null}
      {mensagemSucesso ? (
        <div className="orders-feedback is-success">
          <p>{mensagemSucesso}</p>
          <button className="btn-secondary" type="button" onClick={() => navigate('/pagamento')}>
            Ir para checkout
          </button>
        </div>
      ) : null}

      {carregando ? <OrdersSkeletonList /> : null}

      {mostrarEstadoErro ? (
        <div className="orders-state-card">
          <div className="orders-empty-icon" aria-hidden="true">⚠️</div>
          <p><strong>Não foi possível carregar seus pedidos agora.</strong></p>
          <p>Verifique sua conexão e tente novamente.</p>
          <button className="btn-primary" type="button" onClick={() => { void carregarPedidosIniciais(); }}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!carregando && !mostrarEstadoErro && pedidos.length === 0 ? (
        <div className="orders-state-card">
          <div className="orders-empty-icon" aria-hidden="true">🧺</div>
          <p><strong>Você ainda não possui pedidos.</strong></p>
          <p>Quando finalizar sua primeira compra, ela aparecerá aqui com status e detalhes.</p>
          <Link to="/produtos" className="btn-secondary" style={{ display: 'inline-block' }}>
            Começar compras
          </Link>
        </div>
      ) : null}

      {!carregando && pedidos.length > 0 && pedidosFiltrados.length === 0 ? (
        <div className="orders-state-card is-filter-empty">
          <div className="orders-empty-icon" aria-hidden="true">🔎</div>
          <p><strong>Nenhum pedido encontrado para este filtro.</strong></p>
          <p>Tente outro status ou busque por outro número de pedido.</p>
        </div>
      ) : null}

      {pedidosFiltradosOrdenados.length > 0 ? (
        <div className="orders-list">
          {pedidosFiltradosOrdenados.map((pedido) => {
            const detalhesPedido = detalhesPorPedido[pedido.id];
            const estaAberto = pedidoAbertoId === pedido.id;
            const estaCarregando = Boolean(detalhesEmCarregamento[pedido.id]);
            const resumoItensTexto = detalhesPedido?.resumoTexto || (estaCarregando ? 'Carregando resumo do pedido...' : 'Resumo dos itens disponível ao abrir detalhes.');
            const totalItens = Number.isFinite(Number(detalhesPedido?.totalItens))
              ? Number(detalhesPedido.totalItens)
              : null;
            const statusGrupo = obterGrupoStatus(pedido.status);
            const statusPrincipalLabel = statusGrupo === 'andamento' ? 'Acompanhar pedido' : 'Ver detalhes';
            const pedidoRecente = Number(pedido.id) === pedidoMaisRecenteId;
            const pedidoPagoAgora = Number(pedido.id) === Number(pedidoPagoAgoraId);

            return (
              <article className={`orders-card ${pedidoRecente ? 'is-recent' : ''} ${pedidoPagoAgora ? 'is-paid-now' : ''}`.trim()} key={pedido.id}>
                <div className="orders-card-top">
                  <div>
                    <p className="orders-card-id">Pedido #{pedido.id}</p>
                    <p className="orders-card-date">{formatarDataPedido(pedido.criado_em || pedido.data_pedido, true)}</p>
                  </div>

                  <div className="orders-card-top-right">
                    {pedidoPagoAgora ? <span className="orders-paid-chip">Pago agora</span> : null}
                    {pedidoRecente ? <span className="orders-recent-chip">Mais recente</span> : null}
                    <OrderStatusBadge status={pedido.status} />
                  </div>
                </div>

                <div className="orders-card-middle">
                  <div className="orders-total-box">
                    <span className="orders-total-label">Total</span>
                    <strong className="orders-total-value">R$ {Number(pedido.total || 0).toFixed(2)}</strong>
                  </div>

                  <p className="orders-meta-line">
                    <span>{formatarFormaPagamento(pedido.forma_pagamento)}</span>
                    <span className="orders-meta-dot" aria-hidden="true">•</span>
                    <span>{totalItens === null ? 'Itens a confirmar' : `${totalItens} item(ns)`}</span>
                  </p>
                </div>

                <OrderTimeline status={pedido.status} compact />

                <div className="orders-card-bottom">
                  <p className={`orders-summary ${detalhesPedido ? '' : 'is-placeholder'}`}>
                    {resumoItensTexto}
                  </p>

                  {/* Botão de confirmar recebimento para pedidos em entrega */}
                  {pedido.status === 'enviado' && (
                    <div className="orders-confirmar-recebimento">
                      <div className="orders-entrega-info">
                        <span className="orders-entrega-icon" aria-hidden="true">🛵</span>
                        <span>Seu pedido está a caminho!</span>
                      </div>
                      <button
                        type="button"
                        className="btn-confirmar-recebimento"
                        disabled={confirmandoRecebimento === Number(pedido.id)}
                        onClick={() => handleConfirmarRecebimento(Number(pedido.id))}
                      >
                        {confirmandoRecebimento === Number(pedido.id) ? 'Confirmando...' : '✅ Recebi meu pedido'}
                      </button>
                    </div>
                  )}

                  {/* Indicador visual pra status ativos */}
                  {['preparando', 'pronto_para_retirada'].includes(pedido.status) && (
                    <div className="orders-status-ativo-info">
                      <span className="orders-pulse-dot" />
                      <span>
                        {pedido.status === 'preparando'
                          ? 'Seu pedido está sendo separado...'
                          : pedido.tipo_entrega === 'retirada'
                            ? 'Seu pedido está preparado! Pode buscar na loja.'
                            : 'Seu pedido está preparado e aguardando entregador.'}
                      </span>
                    </div>
                  )}

                  {pedido?.tipo_entrega === 'entrega' && pedido?.entrega_status ? (
                    <div className="orders-status-ativo-info">
                      <span className="orders-pulse-dot" />
                      <span>
                        Entrega: {String(pedido.entrega_status || '').replace(/_/g, ' ')}
                        {pedido?.uber_eta_seconds ? ` • previsão ~${Math.max(1, Math.round(Number(pedido.uber_eta_seconds || 0) / 60))} min` : ''}
                        {pedido?.uber_vehicle_type ? ` • veículo ${String(pedido.uber_vehicle_type).toUpperCase()}` : ''}
                      </span>
                    </div>
                  ) : null}

                  {pedido?.uber_tracking_url ? (
                    <a className="btn-secondary" href={pedido.uber_tracking_url} target="_blank" rel="noreferrer">
                      Acompanhar entrega
                    </a>
                  ) : null}

                  <div className="orders-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        void handleToggleDetalhesPedido(pedido.id);
                      }}
                    >
                      {estaAberto ? 'Ocultar detalhes' : statusPrincipalLabel}
                    </button>

                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={pedidoRepetindoId === Number(pedido.id)}
                      onClick={() => {
                        void handlePedirNovamente(pedido);
                      }}
                    >
                      {pedidoRepetindoId === Number(pedido.id) ? 'Repetindo...' : 'Pedir novamente'}
                    </button>

                    {pedido?.tipo_entrega === 'entrega' ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setTrackingPedidoId(Number(pedido.id))}
                      >
                        Central da entrega
                      </button>
                    ) : null}
                  </div>
                </div>

                {estaAberto ? (
                  <div className="orders-card-details">
                    <div className="orders-details-header">
                      <strong>Detalhes do pedido #{pedido.id}</strong>
                      <span>{formatarDataPedido(pedido.criado_em || pedido.data_pedido, true)}</span>
                    </div>

                    <OrderTimeline status={pedido.status} />

                    {estaCarregando ? <p className="muted-text">Carregando itens do pedido...</p> : null}

                    {!estaCarregando && detalhesPedido?.erro ? (
                      <p className="error-text" role="alert">{detalhesPedido.erro}</p>
                    ) : null}

                    {!estaCarregando && !detalhesPedido?.erro && (detalhesPedido?.itens || []).length === 0 ? (
                      <p className="muted-text">Não há itens registrados para este pedido no momento.</p>
                    ) : null}

                    {!estaCarregando && !detalhesPedido?.erro && (detalhesPedido?.itens || []).length > 0 ? (
                      <div className="orders-items-list">
                        {detalhesPedido.itens.map((item) => (
                          <div className="orders-item-row" key={item.id || `${pedido.id}-${item.produto_id}-${item.nome_produto}`}>
                            <div className="orders-item-main">
                              <p className="orders-item-name">
                                {item.emoji || '📦'} {item.nome_produto || item.nome || 'Item'}
                              </p>
                              <p className="orders-item-meta">
                                {Number(item.quantidade || 0)}x · R$ {Number(item.preco || 0).toFixed(2)}
                              </p>
                            </div>
                            <p className="orders-item-subtotal">R$ {Number(item.subtotal || 0).toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {pedido?.uber_tracking_url ? (
                      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <a className="btn-secondary" href={pedido.uber_tracking_url} target="_blank" rel="noreferrer">
                          Acompanhar entrega
                        </a>
                        {pedido?.uber_vehicle_type ? (
                          <span className="orders-status-badge tone-delivery">Veículo: {String(pedido.uber_vehicle_type).toUpperCase()}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {temMaisPedidos ? (
        <div className="orders-load-more-wrap">
          <button
            className="btn-primary"
            type="button"
            onClick={() => {
              void carregarMaisPedidos();
            }}
            disabled={carregandoMais || carregando}
          >
            {carregandoMais ? 'Carregando mais pedidos...' : 'Carregar pedidos anteriores'}
          </button>
        </div>
      ) : null}

      {trackingPedidoId ? (
        <DeliveryTrackingPanel
          pedidoId={trackingPedidoId}
          open={Boolean(trackingPedidoId)}
          pedidoResumo={pedidos.find((pedido) => Number(pedido?.id) === Number(trackingPedidoId)) || null}
          onClose={() => setTrackingPedidoId(null)}
          onRepeatOrder={() => {
            const pedido = pedidos.find((item) => Number(item?.id) === Number(trackingPedidoId));
            if (pedido) {
              void handlePedirNovamente(pedido);
            }
          }}
        />
      ) : null}
    </section>
  );
}
