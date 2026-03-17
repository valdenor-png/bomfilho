import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  adminGetMe,
  adminLogin,
  adminLogout,
  adminAtualizarStatusPedido,
  adminBuscarProdutoPorCodigoBarras,
  adminCadastrarProduto,
  adminExcluirProduto,
  adminGetImportacoesProdutos,
  adminImportarProdutosPlanilha,
  adminGetPedidos,
  getAdminModeloImportacaoUrl,
  getProdutos,
  isAuthErrorMessage
} from '../lib/api';

const STATUS_OPTIONS = ['pendente', 'preparando', 'enviado', 'entregue', 'cancelado'];
const STATUS_LABELS = {
  pendente: 'Aguardando confirmação',
  preparando: 'Em preparação',
  enviado: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  pago: 'Pago'
};
const ADMIN_PEDIDOS_POR_PAGINA = 30;
const ADMIN_PRODUTOS_POR_PAGINA = 60;
const EXTENSOES_IMPORTACAO_ACEITAS = ['.csv', '.xlsx'];
const STATUS_IMPORTACAO_LABELS = {
  concluido: 'Concluída',
  concluido_com_erros: 'Concluída com alertas',
  simulado: 'Simulação',
  erro: 'Falha'
};
const BRL_CURRENCY = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
const FORMAS_PAGAMENTO_LABELS = {
  pix: 'PIX',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  cartao: 'Cartão',
  dinheiro: 'Dinheiro'
};
const STATUS_OPERACAO_META = {
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
    label: 'Em preparação',
    icon: '📦',
    tone: 'preparing',
    timelineStep: 3
  },
  enviado: {
    label: 'Saiu para entrega',
    icon: '🛵',
    tone: 'delivery',
    timelineStep: 4
  },
  entregue: {
    label: 'Entregue',
    icon: '✅',
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
const STATUS_CHIPS_OPERACIONAIS = ['todos', 'criticos', 'pendente', 'pago', 'preparando', 'enviado', 'entregue', 'cancelado'];
const TIMELINE_ETAPAS_ADMIN = ['Recebido', 'Pagamento', 'Separação', 'Saída', 'Concluído'];
const ORDENACAO_PEDIDOS_OPTIONS = [
  { id: 'prioridade', label: 'Prioridade operacional' },
  { id: 'urgencia', label: 'Urgência operacional' },
  { id: 'mais-recentes', label: 'Mais recentes' },
  { id: 'mais-antigos', label: 'Mais antigos' },
  { id: 'maior-valor', label: 'Maior valor' },
  { id: 'menor-valor', label: 'Menor valor' }
];
const FILTRO_PAGAMENTO_OPTIONS = [
  { id: 'todos', label: 'Pagamento: todos' },
  { id: 'confirmado', label: 'Pagamento confirmado' },
  { id: 'pendente', label: 'Pagamento pendente' },
  { id: 'falhou', label: 'Falha de pagamento' },
  { id: 'pix', label: 'Somente PIX' },
  { id: 'cartao', label: 'Somente cartão' },
  { id: 'dinheiro', label: 'Somente dinheiro' }
];
const OPERACAO_PEDIDOS_LIMITES = Object.freeze({
  pendenteAtencaoMinutos: 20,
  envelhecimentoAtencaoMinutos: 45,
  envelhecimentoUrgenciaMinutos: 90,
  envelhecimentoCriticoMinutos: 180,
  autoRefreshMs: 90000,
  maxPendenciasVisiveisFilaAlta: 2,
  historicoSessaoMaxItens: 30
});
const CONTEXTO_PEDIDOS_LOCAL_STORAGE_KEY = 'bf_admin_pedidos_context_v1';
const AUTO_REFRESH_PEDIDOS_INTERVALO_MS = OPERACAO_PEDIDOS_LIMITES.autoRefreshMs;
const AUTO_REFRESH_PEDIDOS_LABEL = `${Math.round(AUTO_REFRESH_PEDIDOS_INTERVALO_MS / 1000)}s`;
const CAMPOS_DATA_STATUS_PEDIDO = ['status_atualizado_em', 'status_alterado_em', 'status_updated_at', 'status_updated_em'];
const STATUS_CHIPS_OPERACIONAIS_SET = new Set(STATUS_CHIPS_OPERACIONAIS);
const ORDENACAO_PEDIDOS_SET = new Set(ORDENACAO_PEDIDOS_OPTIONS.map((item) => item.id));
const FILTRO_PAGAMENTO_SET = new Set(FILTRO_PAGAMENTO_OPTIONS.map((item) => item.id));

function formatarMoeda(valor) {
  return BRL_CURRENCY.format(Number(valor || 0));
}

function normalizarTextoBusca(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatarFormaPagamentoPedido(formaRaw) {
  const forma = String(formaRaw || '').trim().toLowerCase();
  return FORMAS_PAGAMENTO_LABELS[forma] || 'Não informado';
}

function obterMetaStatusOperacional(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_OPERACAO_META[status] || {
    label: 'Em análise',
    icon: '🧾',
    tone: 'neutral',
    timelineStep: 1
  };
}

function formatarDataHoraOperacional(dataRaw) {
  if (!dataRaw) {
    return '-';
  }

  const data = new Date(dataRaw);
  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatarTempoRelativo(dataRaw) {
  if (!dataRaw) {
    return 'Data não informada';
  }

  const data = new Date(dataRaw);
  if (Number.isNaN(data.getTime())) {
    return 'Data inválida';
  }

  const diffMs = Date.now() - data.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return 'Agora';
  }

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) {
    return 'Agora';
  }

  if (diffMin < 60) {
    return `${diffMin} min atrás`;
  }

  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) {
    return `${diffHoras}h atrás`;
  }

  const diffDias = Math.floor(diffHoras / 24);
  return `${diffDias}d atrás`;
}

function obterDataStatusAtualPedido(pedido) {
  if (!pedido || typeof pedido !== 'object') {
    return null;
  }

  for (const campo of CAMPOS_DATA_STATUS_PEDIDO) {
    const valor = pedido?.[campo];
    if (!valor) {
      continue;
    }

    const data = new Date(valor);
    if (!Number.isNaN(data.getTime())) {
      return valor;
    }
  }

  return null;
}

function obterMetaEnvelhecimentoPedido(statusRaw, tempoMinutosRaw, pagamentoToneRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  const pagamentoTone = String(pagamentoToneRaw || '').trim().toLowerCase();
  const tempoMinutos = Number(tempoMinutosRaw || 0);
  const minutos = Number.isFinite(tempoMinutos) && tempoMinutos > 0 ? tempoMinutos : 0;

  if (['entregue', 'cancelado'].includes(status)) {
    return {
      nivel: 0,
      tone: 'normal',
      label: ''
    };
  }

  if (pagamentoTone === 'error') {
    return {
      nivel: 3,
      tone: 'critical',
      label: 'Pagamento com falha'
    };
  }

  if (minutos >= OPERACAO_PEDIDOS_LIMITES.envelhecimentoCriticoMinutos) {
    return {
      nivel: 3,
      tone: 'critical',
      label: 'Fila crítica'
    };
  }

  if (minutos >= OPERACAO_PEDIDOS_LIMITES.envelhecimentoUrgenciaMinutos) {
    return {
      nivel: 2,
      tone: 'urgent',
      label: 'Fila alta'
    };
  }

  if (minutos >= OPERACAO_PEDIDOS_LIMITES.envelhecimentoAtencaoMinutos) {
    return {
      nivel: 1,
      tone: 'attention',
      label: 'Tempo em fila'
    };
  }

  if (status === 'pendente' && minutos >= OPERACAO_PEDIDOS_LIMITES.pendenteAtencaoMinutos) {
    return {
      nivel: 1,
      tone: 'attention',
      label: 'Confirmação pendente'
    };
  }

  return {
    nivel: 0,
    tone: 'normal',
    label: ''
  };
}

function obterContextoPedidosOperacionaisInicial() {
  const contextoPadrao = {
    filtroStatus: 'todos',
    filtroPagamento: 'todos',
    ordenacao: 'prioridade',
    busca: '',
    pedidoExpandidoId: null,
    autoRefresh: false,
    modoFilaAlta: false
  };

  if (typeof window === 'undefined' || !window.localStorage) {
    return contextoPadrao;
  }

  try {
    const salvoRaw = window.localStorage.getItem(CONTEXTO_PEDIDOS_LOCAL_STORAGE_KEY);
    if (!salvoRaw) {
      return contextoPadrao;
    }

    const salvo = JSON.parse(salvoRaw);
    const filtroStatus = STATUS_CHIPS_OPERACIONAIS_SET.has(String(salvo?.filtroStatus || ''))
      ? String(salvo.filtroStatus)
      : contextoPadrao.filtroStatus;
    const filtroPagamento = FILTRO_PAGAMENTO_SET.has(String(salvo?.filtroPagamento || ''))
      ? String(salvo.filtroPagamento)
      : contextoPadrao.filtroPagamento;
    const ordenacao = ORDENACAO_PEDIDOS_SET.has(String(salvo?.ordenacao || ''))
      ? String(salvo.ordenacao)
      : contextoPadrao.ordenacao;
    const busca = String(salvo?.busca || '').trim();
    const pedidoExpandidoRaw = Number(salvo?.pedidoExpandidoId || 0);
    const pedidoExpandidoId = Number.isInteger(pedidoExpandidoRaw) && pedidoExpandidoRaw > 0
      ? pedidoExpandidoRaw
      : null;

    return {
      filtroStatus,
      filtroPagamento,
      ordenacao,
      busca,
      pedidoExpandidoId,
      autoRefresh: Boolean(salvo?.autoRefresh),
      modoFilaAlta: Boolean(salvo?.modoFilaAlta)
    };
  } catch {
    return contextoPadrao;
  }
}

function salvarContextoPedidosOperacionais(contexto) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(CONTEXTO_PEDIDOS_LOCAL_STORAGE_KEY, JSON.stringify(contexto));
  } catch {
    // Ignore falhas de persistência local para não afetar operação.
  }
}

function montarResumoOperacionalPedido(pedido) {
  const itensPrincipais = Array.isArray(pedido?.itensLista) && pedido.itensLista.length > 0
    ? pedido.itensLista.slice(0, 4).map((item) => `${item.quantidade}x ${item.nome}`).join(', ')
    : String(pedido?.resumoItensTexto || 'Itens não detalhados neste pedido.');
  const pagamentoDetalhe = pedido?.pagamentoMeta?.detalhe
    ? ` (${pedido.pagamentoMeta.detalhe})`
    : '';

  return [
    `Pedido #${pedido?.id || '-'}`,
    `Cliente: ${pedido?.clienteNome || '-'}`,
    `Telefone: ${pedido?.clienteTelefone || 'não informado'}`,
    `Total: ${formatarMoeda(pedido?.totalNumero || pedido?.total || 0)}`,
    `Status: ${pedido?.statusMeta?.label || formatarStatusPedido(pedido?.status || '')}`,
    `Pagamento: ${pedido?.pagamentoMeta?.label || '-'}${pagamentoDetalhe}`,
    `Endereço: ${pedido?.enderecoTexto || 'não cadastrado'}`,
    `Itens principais: ${itensPrincipais}`
  ].join('\n');
}

function obterObservacaoOperacionalPedido(pedido) {
  const candidatos = [
    pedido?.observacao,
    pedido?.observacoes,
    pedido?.observacao_cliente,
    pedido?.comentario,
    pedido?.nota
  ];

  for (const item of candidatos) {
    const texto = String(item || '').trim();
    if (texto) {
      return texto;
    }
  }

  return '';
}

function montarPendenciasOperacionaisPedido({
  pagamentoMeta,
  envelhecimentoMeta,
  requerAcao,
  proximoStatus,
  observacaoOperacional
}) {
  const pendencias = [];

  if (pagamentoMeta?.tone === 'error') {
    pendencias.push({
      id: 'pagamento-falhou',
      tone: 'error',
      label: 'Pagamento com falha'
    });
  } else if (pagamentoMeta?.tone === 'waiting' || pagamentoMeta?.tone === 'attention') {
    pendencias.push({
      id: 'pagamento-pendente',
      tone: 'attention',
      label: 'Pagamento pendente'
    });
  }

  if (envelhecimentoMeta?.nivel >= 1 && envelhecimentoMeta?.label) {
    pendencias.push({
      id: 'tempo-operacao',
      tone: envelhecimentoMeta.tone === 'critical' ? 'error' : 'attention',
      label: envelhecimentoMeta.label
    });
  }

  if (requerAcao && proximoStatus) {
    pendencias.push({
      id: 'aguardando-proximo-passo',
      tone: 'action',
      label: `Avançar para ${formatarStatusPedido(proximoStatus)}`
    });
  }

  if (observacaoOperacional) {
    pendencias.push({
      id: 'observacao-importante',
      tone: 'note',
      label: 'Observação do cliente'
    });
  }

  return pendencias.slice(0, 4);
}

function obterProximoStatusPedido(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();

  if (status === 'pendente' || status === 'pago') {
    return 'preparando';
  }

  if (status === 'preparando') {
    return 'enviado';
  }

  if (status === 'enviado') {
    return 'entregue';
  }

  return null;
}

function obterLabelAcaoRapida(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();

  if (status === 'pendente' || status === 'pago') {
    return 'Iniciar separação';
  }

  if (status === 'preparando') {
    return 'Marcar saída';
  }

  if (status === 'enviado') {
    return 'Marcar entregue';
  }

  return '';
}

function formatarEnderecoOperacional(endereco) {
  if (!endereco || typeof endereco !== 'object') {
    return 'Endereço não cadastrado para este pedido.';
  }

  const rua = String(endereco.rua || '').trim();
  const numero = String(endereco.numero || '').trim();
  const bairro = String(endereco.bairro || '').trim();
  const cidade = String(endereco.cidade || '').trim();
  const estado = String(endereco.estado || '').trim();
  const cep = String(endereco.cep || '').trim();

  const linha1 = [rua, numero].filter(Boolean).join(', ');
  const linha2 = [bairro, cidade, estado].filter(Boolean).join(' - ');
  const texto = [linha1, linha2, cep].filter(Boolean).join(' | ');

  return texto || 'Endereço não cadastrado para este pedido.';
}

function montarResumoItensOperacional(itensRaw) {
  const itens = Array.isArray(itensRaw) ? itensRaw : [];

  if (itens.length === 0) {
    return {
      totalItens: 0,
      resumoTexto: 'Itens não detalhados neste pedido.'
    };
  }

  const totalItens = itens.reduce((acc, item) => {
    const quantidade = Number(item?.quantidade || 0);
    return acc + (Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1);
  }, 0);

  const nomes = itens
    .map((item) => String(item?.nome_produto || item?.nome || '').trim())
    .filter(Boolean);

  const nomesUnicos = [...new Set(nomes)];
  const preview = nomesUnicos.slice(0, 3);
  const extras = Math.max(0, nomesUnicos.length - preview.length);
  const resumoTexto = preview.length
    ? `${preview.join(', ')}${extras > 0 ? ` +${extras} item(ns)` : ''}`
    : 'Itens disponíveis ao abrir detalhes.';

  return {
    totalItens,
    resumoTexto
  };
}

function inferirPagamentoMeta(pedido) {
  const statusPedido = String(pedido?.status || '').trim().toLowerCase();
  const forma = String(pedido?.forma_pagamento || '').trim().toLowerCase();
  const pixStatus = String(pedido?.pix_status || '').trim().toUpperCase();
  const formaLabel = formatarFormaPagamentoPedido(forma);

  if (statusPedido === 'cancelado') {
    return {
      tone: 'neutral',
      label: 'Pedido cancelado',
      detalhe: formaLabel
    };
  }

  if (forma === 'pix') {
    if (pixStatus === 'PAID' || ['pago', 'preparando', 'enviado', 'entregue'].includes(statusPedido)) {
      return {
        tone: 'ok',
        label: 'Pagamento confirmado',
        detalhe: pixStatus ? `PIX ${pixStatus}` : 'PIX'
      };
    }

    if (['DECLINED', 'CANCELED', 'EXPIRED', 'FAILED'].includes(pixStatus)) {
      return {
        tone: 'error',
        label: 'Falha no pagamento',
        detalhe: `PIX ${pixStatus}`
      };
    }

    if (pixStatus === 'IN_ANALYSIS') {
      return {
        tone: 'attention',
        label: 'Pagamento em análise',
        detalhe: 'PIX'
      };
    }

    return {
      tone: 'waiting',
      label: 'Aguardando pagamento',
      detalhe: 'PIX pendente'
    };
  }

  if (forma === 'dinheiro') {
    if (statusPedido === 'entregue') {
      return {
        tone: 'ok',
        label: 'Pagamento concluído',
        detalhe: formaLabel
      };
    }

    return {
      tone: 'waiting',
      label: 'Pagamento na entrega',
      detalhe: formaLabel
    };
  }

  if (['credito', 'debito', 'cartao'].includes(forma)) {
    if (['pago', 'preparando', 'enviado', 'entregue'].includes(statusPedido)) {
      return {
        tone: 'ok',
        label: 'Pagamento confirmado',
        detalhe: formaLabel
      };
    }

    return {
      tone: 'attention',
      label: 'Pagamento a confirmar',
      detalhe: formaLabel
    };
  }

  return {
    tone: 'neutral',
    label: 'Pagamento não informado',
    detalhe: '-'
  };
}

function normalizarTelefoneWhatsapp(telefoneRaw) {
  const digits = String(telefoneRaw || '').replace(/\D/g, '');

  if (digits.length < 10) {
    return '';
  }

  if (digits.startsWith('55')) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function montarLinkWhatsappPedido(pedido) {
  const telefone = normalizarTelefoneWhatsapp(pedido?.cliente_telefone);
  if (!telefone) {
    return '';
  }

  const mensagem = encodeURIComponent(
    `Olá! Estamos acompanhando seu pedido #${pedido?.id || ''} na BomFilho.`
  );

  return `https://wa.me/${telefone}?text=${mensagem}`;
}

async function copiarTextoNavegador(texto) {
  const valor = String(texto || '');
  if (!valor) {
    throw new Error('Valor vazio para cópia.');
  }

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(valor);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = valor;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

function formatarStatusImportacao(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_IMPORTACAO_LABELS[status] || 'Em processamento';
}

function formatarTamanhoArquivo(bytesRaw) {
  const bytes = Number(bytesRaw || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validarArquivoImportacao(arquivo) {
  if (!arquivo) {
    return 'Selecione um arquivo para continuar.';
  }

  const nomeArquivo = String(arquivo.name || '').trim();
  const nomeLower = nomeArquivo.toLowerCase();
  const extensaoValida = EXTENSOES_IMPORTACAO_ACEITAS.some((extensao) => nomeLower.endsWith(extensao));

  if (!extensaoValida) {
    return 'Formato inválido. Envie um arquivo .xlsx ou .csv.';
  }

  return '';
}

function formatarStatusPedido(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_LABELS[status] || 'Em análise';
}

function criarPaginacaoInicial(limite) {
  return {
    pagina: 1,
    limite,
    total: 0,
    total_paginas: 1,
    tem_mais: false
  };
}

function normalizarPaginacao(paginacaoRaw, paginaFallback, limiteFallback) {
  const pagina = Number(paginacaoRaw?.pagina || paginaFallback || 1);
  const limite = Number(paginacaoRaw?.limite || limiteFallback || 1);
  const total = Number(paginacaoRaw?.total || 0);
  const totalPaginas = Number(paginacaoRaw?.total_paginas || 1);

  return {
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
    limite: Number.isFinite(limite) && limite > 0 ? limite : limiteFallback,
    total: Number.isFinite(total) && total >= 0 ? total : 0,
    total_paginas: Number.isFinite(totalPaginas) && totalPaginas > 0 ? totalPaginas : 1,
    tem_mais: Boolean(paginacaoRaw?.tem_mais)
  };
}

const initialProduto = {
  codigo_barras: '',
  nome: '',
  descricao: '',
  marca: '',
  imagem: '',
  preco: '',
  unidade: 'un',
  categoria: '',
  emoji: '📦',
  estoque: 0
};

export default function AdminPage() {
  const contextoPedidosInicial = useMemo(() => obterContextoPedidosOperacionaisInicial(), []);
  const [adminUsuario, setAdminUsuario] = useState('admin');
  const [adminSenha, setAdminSenha] = useState('');
  const [adminAutenticado, setAdminAutenticado] = useState(null);
  const [tab, setTab] = useState('pedidos');
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [paginacaoPedidos, setPaginacaoPedidos] = useState(() => criarPaginacaoInicial(ADMIN_PEDIDOS_POR_PAGINA));
  const [paginacaoProdutos, setPaginacaoProdutos] = useState(() => criarPaginacaoInicial(ADMIN_PRODUTOS_POR_PAGINA));
  const [statusDraft, setStatusDraft] = useState({});
  const [filtroPedidoStatus, setFiltroPedidoStatus] = useState(() => contextoPedidosInicial.filtroStatus);
  const [filtroPedidoPagamento, setFiltroPedidoPagamento] = useState(() => contextoPedidosInicial.filtroPagamento);
  const [ordenacaoPedidos, setOrdenacaoPedidos] = useState(() => contextoPedidosInicial.ordenacao);
  const [buscaPedidosOperacional, setBuscaPedidosOperacional] = useState(() => contextoPedidosInicial.busca);
  const [pedidoExpandidoId, setPedidoExpandidoId] = useState(() => contextoPedidosInicial.pedidoExpandidoId);
  const [autoRefreshPedidosAtivo, setAutoRefreshPedidosAtivo] = useState(() => contextoPedidosInicial.autoRefresh);
  const [modoFilaAltaAtivo, setModoFilaAltaAtivo] = useState(() => contextoPedidosInicial.modoFilaAlta);
  const [atualizandoStatusPedidoId, setAtualizandoStatusPedidoId] = useState(null);
  const [feedbackPedidos, setFeedbackPedidos] = useState({ tipo: '', mensagem: '' });
  const [ultimasAcoesPedidos, setUltimasAcoesPedidos] = useState({});
  const [historicoAcoesSessao, setHistoricoAcoesSessao] = useState([]);
  const [ultimaAtualizacaoPedidosEm, setUltimaAtualizacaoPedidosEm] = useState(null);
  const [novosPedidosDetectados, setNovosPedidosDetectados] = useState(0);
  const [produtoForm, setProdutoForm] = useState(initialProduto);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [carregandoPedidos, setCarregandoPedidos] = useState(false);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [salvandoProduto, setSalvandoProduto] = useState(false);
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [filtroFinanceiroStatus, setFiltroFinanceiroStatus] = useState('todos');
  const [filtroFinanceiroPeriodo, setFiltroFinanceiroPeriodo] = useState('mes');
  const [filtroFinanceiroBusca, setFiltroFinanceiroBusca] = useState('');
  const [filtroFinanceiroOrdem, setFiltroFinanceiroOrdem] = useState('data_desc');
  const [filtroFinanceiroInicio, setFiltroFinanceiroInicio] = useState('');
  const [filtroFinanceiroFim, setFiltroFinanceiroFim] = useState('');
  const [arquivoImportacao, setArquivoImportacao] = useState(null);
  const [arrastandoImportacao, setArrastandoImportacao] = useState(false);
  const [importarCriarNovos, setImportarCriarNovos] = useState(false);
  const [importandoPlanilha, setImportandoPlanilha] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);
  const [historicoImportacoes, setHistoricoImportacoes] = useState([]);
  const [carregandoImportacoes, setCarregandoImportacoes] = useState(false);
  const modeloImportacaoUrl = useMemo(() => getAdminModeloImportacaoUrl(), []);

  const hostname = window.location.hostname;
  const isLocalHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';

  useEffect(() => {
    if (!isLocalHost) {
      return;
    }

    let ativo = true;

    async function validarSessaoAdmin() {
      setCarregando(true);
      setErro('');

      try {
        const data = await adminGetMe();
        if (!ativo) {
          return;
        }

        setAdminAutenticado(true);
        if (data?.admin?.usuario) {
          setAdminUsuario(String(data.admin.usuario));
        }
      } catch (error) {
        if (!ativo) {
          return;
        }

        setAdminAutenticado(false);
        if (!isAuthErrorMessage(error.message)) {
          setErro(error.message);
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    validarSessaoAdmin();

    return () => {
      ativo = false;
    };
  }, [isLocalHost]);

  useEffect(() => {
    if (adminAutenticado === true && isLocalHost) {
      void carregarTudo({ resetPagina: true });
    }
  }, [adminAutenticado, isLocalHost]);

  useEffect(() => {
    if (adminAutenticado === true && isLocalHost && tab === 'importacao') {
      void carregarHistoricoImportacoes();
    }
  }, [adminAutenticado, isLocalHost, tab]);

  useEffect(() => {
    salvarContextoPedidosOperacionais({
      filtroStatus: filtroPedidoStatus,
      filtroPagamento: filtroPedidoPagamento,
      ordenacao: ordenacaoPedidos,
      busca: buscaPedidosOperacional,
      pedidoExpandidoId,
      autoRefresh: autoRefreshPedidosAtivo,
      modoFilaAlta: modoFilaAltaAtivo
    });
  }, [
    autoRefreshPedidosAtivo,
    buscaPedidosOperacional,
    filtroPedidoPagamento,
    filtroPedidoStatus,
    modoFilaAltaAtivo,
    ordenacaoPedidos,
    pedidoExpandidoId
  ]);

  useEffect(() => {
    if (!pedidoExpandidoId) {
      return;
    }

    const existeNaLista = pedidos.some((pedido) => Number(pedido?.id || 0) === Number(pedidoExpandidoId));
    if (!existeNaLista) {
      setPedidoExpandidoId(null);
    }
  }, [pedidoExpandidoId, pedidos]);

  useEffect(() => {
    if (adminAutenticado !== true || tab !== 'pedidos' || !autoRefreshPedidosAtivo) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!carregandoPedidos) {
        void carregarPedidosPagina(paginacaoPedidos.pagina, { detectarNovos: true });
      }
    }, AUTO_REFRESH_PEDIDOS_INTERVALO_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [adminAutenticado, autoRefreshPedidosAtivo, carregandoPedidos, paginacaoPedidos.pagina, tab]);

  function aplicarDadosPedidos(pedidosData, paginaSolicitada, { detectarNovos = false } = {}) {
    const pedidosList = Array.isArray(pedidosData?.pedidos) ? pedidosData.pedidos : [];

    if (detectarNovos && Number(paginaSolicitada || 1) === 1) {
      const idsAtuais = new Set(
        pedidos
          .map((pedido) => Number(pedido?.id || 0))
          .filter((id) => Number.isInteger(id) && id > 0)
      );

      if (idsAtuais.size > 0) {
        const idsNovos = pedidosList
          .map((pedido) => Number(pedido?.id || 0))
          .filter((id) => Number.isInteger(id) && id > 0)
          .filter((id) => !idsAtuais.has(id));
        setNovosPedidosDetectados(idsNovos.length);
      } else {
        setNovosPedidosDetectados(0);
      }
    } else if (detectarNovos) {
      setNovosPedidosDetectados(0);
    }

    setUltimaAtualizacaoPedidosEm(Date.now());
    setPedidos(pedidosList);
    setPaginacaoPedidos(normalizarPaginacao(pedidosData?.paginacao, paginaSolicitada, ADMIN_PEDIDOS_POR_PAGINA));

    setStatusDraft((atual) => {
      const draft = {};
      pedidosList.forEach((pedido) => {
        draft[pedido.id] = atual[pedido.id] || pedido.status;
      });
      return draft;
    });
  }

  function aplicarDadosProdutos(produtosData, paginaSolicitada) {
    const produtosList = Array.isArray(produtosData?.produtos) ? produtosData.produtos : [];
    setProdutos(produtosList);
    setPaginacaoProdutos(normalizarPaginacao(produtosData?.paginacao, paginaSolicitada, ADMIN_PRODUTOS_POR_PAGINA));
  }

  async function carregarPedidosPagina(paginaDestino, { detectarNovos = true } = {}) {
    if (adminAutenticado !== true) {
      return false;
    }

    const paginaNormalizada = Math.max(1, Number(paginaDestino || 1));
    setCarregandoPedidos(true);
    setErro('');

    try {
      const pedidosData = await adminGetPedidos({
        page: paginaNormalizada,
        limit: ADMIN_PEDIDOS_POR_PAGINA
      });
      aplicarDadosPedidos(pedidosData, paginaNormalizada, { detectarNovos });
      return true;
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAdminAutenticado(false);
        setPedidos([]);
        setStatusDraft({});
        setUltimasAcoesPedidos({});
        setPaginacaoPedidos(criarPaginacaoInicial(ADMIN_PEDIDOS_POR_PAGINA));
      }
      setErro(error.message);
      return false;
    } finally {
      setCarregandoPedidos(false);
    }
  }

  async function carregarProdutosPagina(paginaDestino) {
    if (adminAutenticado !== true) {
      return;
    }

    const paginaNormalizada = Math.max(1, Number(paginaDestino || 1));
    setCarregandoProdutos(true);
    setErro('');

    try {
      const produtosData = await getProdutos({
        page: paginaNormalizada,
        limit: ADMIN_PRODUTOS_POR_PAGINA
      });
      aplicarDadosProdutos(produtosData, paginaNormalizada);
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAdminAutenticado(false);
        setProdutos([]);
        setPaginacaoProdutos(criarPaginacaoInicial(ADMIN_PRODUTOS_POR_PAGINA));
      }
      setErro(error.message);
    } finally {
      setCarregandoProdutos(false);
    }
  }

  async function carregarHistoricoImportacoes() {
    if (adminAutenticado !== true) {
      return;
    }

    setCarregandoImportacoes(true);

    try {
      const data = await adminGetImportacoesProdutos({
        page: 1,
        limit: 20
      });

      const lista = Array.isArray(data?.importacoes) ? data.importacoes : [];
      setHistoricoImportacoes(lista);
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAdminAutenticado(false);
        setHistoricoImportacoes([]);
      }
      setErro(error.message);
    } finally {
      setCarregandoImportacoes(false);
    }
  }

  function selecionarArquivoImportacao(arquivo) {
    const mensagemValidacao = validarArquivoImportacao(arquivo);
    if (mensagemValidacao) {
      setErro(mensagemValidacao);
      return;
    }

    setErro('');
    setResultadoImportacao(null);
    setArquivoImportacao(arquivo);
  }

  function handleArquivoImportacaoChange(event) {
    const arquivo = event.target.files?.[0] || null;
    if (!arquivo) {
      return;
    }

    selecionarArquivoImportacao(arquivo);
  }

  function handleDragOverImportacao(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!arrastandoImportacao) {
      setArrastandoImportacao(true);
    }
  }

  function handleDragLeaveImportacao(event) {
    event.preventDefault();
    event.stopPropagation();
    setArrastandoImportacao(false);
  }

  function handleDropImportacao(event) {
    event.preventDefault();
    event.stopPropagation();
    setArrastandoImportacao(false);

    const arquivo = event.dataTransfer?.files?.[0] || null;
    if (!arquivo) {
      return;
    }

    selecionarArquivoImportacao(arquivo);
  }

  async function executarImportacaoPlanilha({ simular = false } = {}) {
    setErro('');

    const mensagemValidacao = validarArquivoImportacao(arquivoImportacao);
    if (mensagemValidacao) {
      setErro(mensagemValidacao);
      return;
    }

    setImportandoPlanilha(true);

    try {
      const resultado = await adminImportarProdutosPlanilha({
        arquivo: arquivoImportacao,
        criarNovos: importarCriarNovos,
        simular
      });

      setResultadoImportacao(resultado);

      if (!simular && (Number(resultado?.total_atualizados || 0) > 0 || Number(resultado?.total_criados || 0) > 0)) {
        await carregarProdutosPagina(1);
      }

      if (!simular) {
        await carregarHistoricoImportacoes();
        setArquivoImportacao(null);
      }
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAdminAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setImportandoPlanilha(false);
    }
  }

  async function handleImportarPlanilha(event) {
    event.preventDefault();
    await executarImportacaoPlanilha({ simular: false });
  }

  async function handleSimularPlanilha() {
    await executarImportacaoPlanilha({ simular: true });
  }

  async function carregarTudo({ resetPagina = false } = {}) {
    if (adminAutenticado !== true) {
      return;
    }

    const paginaPedidosDestino = resetPagina ? 1 : Math.max(1, Number(paginacaoPedidos.pagina || 1));
    const paginaProdutosDestino = resetPagina ? 1 : Math.max(1, Number(paginacaoProdutos.pagina || 1));

    setCarregando(true);
    setCarregandoPedidos(true);
    setCarregandoProdutos(true);
    setErro('');

    try {
      const [pedidosData, produtosData] = await Promise.all([
        adminGetPedidos({
          page: paginaPedidosDestino,
          limit: ADMIN_PEDIDOS_POR_PAGINA
        }),
        getProdutos({
          page: paginaProdutosDestino,
          limit: ADMIN_PRODUTOS_POR_PAGINA
        })
      ]);

      aplicarDadosPedidos(pedidosData, paginaPedidosDestino, { detectarNovos: !resetPagina });
      aplicarDadosProdutos(produtosData, paginaProdutosDestino);
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAdminAutenticado(false);
        setPedidos([]);
        setProdutos([]);
        setStatusDraft({});
        setUltimasAcoesPedidos({});
        setPaginacaoPedidos(criarPaginacaoInicial(ADMIN_PEDIDOS_POR_PAGINA));
        setPaginacaoProdutos(criarPaginacaoInicial(ADMIN_PRODUTOS_POR_PAGINA));
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
      setCarregandoPedidos(false);
      setCarregandoProdutos(false);
    }
  }

  async function handleAdminLogin(event) {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const data = await adminLogin(adminUsuario.trim(), adminSenha);
      setAdminAutenticado(true);
      if (data?.usuario) {
        setAdminUsuario(String(data.usuario));
      }
      setAdminSenha('');
    } catch (error) {
      setErro(error.message);
    } finally {
      setCarregando(false);
    }
  }

  async function handleAdminLogout() {
    setErro('');
    setCarregando(true);
    try {
      await adminLogout();
    } catch (error) {
      if (!isAuthErrorMessage(error.message)) {
        setErro(error.message);
      }
    } finally {
      setCarregando(false);
    }

    setAdminAutenticado(false);
    setAdminSenha('');
    setPedidos([]);
    setProdutos([]);
    setStatusDraft({});
    setFiltroPedidoStatus('todos');
    setFiltroPedidoPagamento('todos');
    setOrdenacaoPedidos('prioridade');
    setBuscaPedidosOperacional('');
    setPedidoExpandidoId(null);
    setAutoRefreshPedidosAtivo(false);
    setModoFilaAltaAtivo(false);
    setAtualizandoStatusPedidoId(null);
    setFeedbackPedidos({ tipo: '', mensagem: '' });
    setUltimasAcoesPedidos({});
    setHistoricoAcoesSessao([]);
    setUltimaAtualizacaoPedidosEm(null);
    setNovosPedidosDetectados(0);
    setPaginacaoPedidos(criarPaginacaoInicial(ADMIN_PEDIDOS_POR_PAGINA));
    setPaginacaoProdutos(criarPaginacaoInicial(ADMIN_PRODUTOS_POR_PAGINA));
    setArquivoImportacao(null);
    setArrastandoImportacao(false);
    setImportandoPlanilha(false);
    setResultadoImportacao(null);
    setHistoricoImportacoes([]);
  }

  const kpis = useMemo(() => {
    const total = pedidos.length;
    const pendentes = pedidos.filter((pedido) => pedido.status === 'pendente').length;
    const emEntrega = pedidos.filter((pedido) => pedido.status === 'enviado').length;
    const faturamento = pedidos
      .filter((pedido) => pedido.status !== 'cancelado')
      .reduce((acc, pedido) => acc + Number(pedido.total || 0), 0);

    return { total, pendentes, emEntrega, faturamento };
  }, [pedidos]);

  const pedidosOperacionais = useMemo(() => {
    return pedidos.map((pedido) => {
      const statusNormalizado = String(pedido?.status || '').trim().toLowerCase();
      const statusMeta = obterMetaStatusOperacional(statusNormalizado);
      const pagamentoMeta = inferirPagamentoMeta(pedido);
      const dataRaw = pedido?.criado_em || pedido?.data_pedido || null;
      const data = dataRaw ? new Date(dataRaw) : null;
      const dataMs = data && !Number.isNaN(data.getTime()) ? data.getTime() : 0;
      const tempoMinutos = dataMs > 0 ? Math.floor((Date.now() - dataMs) / 60000) : 0;
      const dataStatusRaw = obterDataStatusAtualPedido(pedido);
      const dataStatus = dataStatusRaw ? new Date(dataStatusRaw) : null;
      const dataStatusMs = dataStatus && !Number.isNaN(dataStatus.getTime()) ? dataStatus.getTime() : 0;
      const tempoNoStatusMinutos = dataStatusMs > 0 ? Math.floor((Date.now() - dataStatusMs) / 60000) : null;
      const resumoItens = montarResumoItensOperacional(pedido?.itens);
      const formaPagamento = String(pedido?.forma_pagamento || '').trim().toLowerCase();
      const enderecoDisponivel = Boolean(pedido?.endereco && typeof pedido?.endereco === 'object' && pedido?.endereco?.rua);
      const observacaoOperacional = obterObservacaoOperacionalPedido(pedido);
      const telefoneCliente = String(pedido?.cliente_telefone || '').trim();
      const clienteNome = String(pedido?.cliente_nome || '').trim() || 'Cliente não identificado';
      const totalNumero = Number(pedido?.total || 0);
      const itensLista = Array.isArray(pedido?.itens)
        ? pedido.itens.map((item, index) => {
          const quantidade = Math.max(1, Number(item?.quantidade || 1));
          const preco = Number(item?.preco || 0);
          const subtotal = Number(item?.subtotal || (quantidade * preco));

          return {
            id: Number(item?.id || 0) || `item-${pedido?.id}-${index}`,
            nome: String(item?.nome_produto || item?.nome || `Item ${index + 1}`).trim(),
            quantidade,
            preco,
            subtotal
          };
        })
        : [];

      const requerAcao = ['pendente', 'pago', 'preparando', 'enviado'].includes(statusNormalizado);
      const envelhecimentoMeta = obterMetaEnvelhecimentoPedido(statusNormalizado, tempoMinutos, pagamentoMeta.tone);
      const proximoStatus = obterProximoStatusPedido(statusNormalizado);
      const urgente = envelhecimentoMeta.nivel >= 2;
      const critico = envelhecimentoMeta.nivel >= 3 || statusNormalizado === 'pendente' || pagamentoMeta.tone === 'error';
      const tempoNoStatusDisponivel = Number.isFinite(tempoNoStatusMinutos) && tempoNoStatusMinutos >= 0;
      const pendenciasOperacionais = montarPendenciasOperacionaisPedido({
        pagamentoMeta,
        envelhecimentoMeta,
        requerAcao,
        proximoStatus,
        observacaoOperacional
      });

      return {
        ...pedido,
        statusNormalizado,
        statusMeta,
        pagamentoMeta,
        dataLabel: formatarDataHoraOperacional(dataRaw),
        tempoRelativo: formatarTempoRelativo(dataRaw),
        tempoDesdeCriacaoLabel: formatarTempoRelativo(dataRaw),
        tempoDesdeCriacaoMinutos: tempoMinutos,
        tempoNoStatusDisponivel,
        tempoNoStatusLabel: tempoNoStatusDisponivel ? formatarTempoRelativo(dataStatusRaw) : '',
        tempoNoStatusDataLabel: tempoNoStatusDisponivel ? formatarDataHoraOperacional(dataStatusRaw) : '',
        envelhecimentoNivel: envelhecimentoMeta.nivel,
        envelhecimentoTone: envelhecimentoMeta.tone,
        envelhecimentoLabel: envelhecimentoMeta.label,
        dataMs,
        totalNumero,
        formaPagamento,
        formaPagamentoLabel: formatarFormaPagamentoPedido(formaPagamento),
        pixStatus: String(pedido?.pix_status || '').trim().toUpperCase(),
        clienteNome,
        clienteTelefone: telefoneCliente,
        observacaoOperacional,
        pendenciasOperacionais,
        resumoItensTexto: resumoItens.resumoTexto,
        totalItens: resumoItens.totalItens,
        itensLista,
        enderecoDisponivel,
        enderecoTexto: formatarEnderecoOperacional(pedido?.endereco),
        tipoAtendimento: enderecoDisponivel ? 'Entrega' : 'Retirada/indefinido',
        whatsappLink: montarLinkWhatsappPedido(pedido),
        proximoStatus,
        acaoRapidaLabel: obterLabelAcaoRapida(statusNormalizado),
        requerAcao,
        urgente,
        critico,
        indiceBusca: normalizarTextoBusca([
          pedido?.id,
          clienteNome,
          telefoneCliente,
          formaPagamento,
          statusNormalizado,
          resumoItens.resumoTexto,
          observacaoOperacional,
          pendenciasOperacionais.map((item) => item.label).join(' ')
        ].join(' '))
      };
    });
  }, [pedidos]);

  const resumoPedidosOperacionais = useMemo(() => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

    const contagemPorStatus = {
      pendente: 0,
      pago: 0,
      preparando: 0,
      enviado: 0,
      entregue: 0,
      cancelado: 0
    };

    let criticos = 0;
    let aguardandoAcao = 0;
    let emAndamento = 0;
    let concluidosHoje = 0;
    let pendentesPagamento = 0;

    pedidosOperacionais.forEach((pedido) => {
      if (Object.prototype.hasOwnProperty.call(contagemPorStatus, pedido.statusNormalizado)) {
        contagemPorStatus[pedido.statusNormalizado] += 1;
      }

      if (pedido.critico) {
        criticos += 1;
      }

      if (pedido.requerAcao) {
        aguardandoAcao += 1;
      }

      if (['pago', 'preparando', 'enviado'].includes(pedido.statusNormalizado)) {
        emAndamento += 1;
      }

      if (pedido.statusNormalizado === 'entregue' && pedido.dataMs > 0 && pedido.dataMs >= inicioHoje.getTime()) {
        concluidosHoje += 1;
      }

      if (['waiting', 'attention', 'error'].includes(pedido.pagamentoMeta.tone)) {
        pendentesPagamento += 1;
      }
    });

    return {
      total: pedidosOperacionais.length,
      criticos,
      aguardandoAcao,
      emAndamento,
      concluidosHoje,
      pendentesPagamento,
      contagemPorStatus
    };
  }, [pedidosOperacionais]);

  const statusChipsOperacionais = useMemo(() => {
    return STATUS_CHIPS_OPERACIONAIS.map((id) => {
      if (id === 'todos') {
        return {
          id,
          label: 'Todos',
          count: resumoPedidosOperacionais.total
        };
      }

      if (id === 'criticos') {
        return {
          id,
          label: 'Críticos',
          count: resumoPedidosOperacionais.criticos
        };
      }

      return {
        id,
        label: formatarStatusPedido(id),
        count: resumoPedidosOperacionais.contagemPorStatus[id] || 0
      };
    });
  }, [resumoPedidosOperacionais]);

  const filtrosPedidosAplicados = useMemo(() => {
    const ativos = [];

    if (filtroPedidoStatus !== 'todos') {
      ativos.push(`Status: ${filtroPedidoStatus === 'criticos' ? 'Críticos' : formatarStatusPedido(filtroPedidoStatus)}`);
    }

    if (filtroPedidoPagamento !== 'todos') {
      const opcao = FILTRO_PAGAMENTO_OPTIONS.find((item) => item.id === filtroPedidoPagamento);
      if (opcao) {
        ativos.push(opcao.label);
      }
    }

    const busca = String(buscaPedidosOperacional || '').trim();
    if (busca) {
      ativos.push(`Busca: ${busca}`);
    }

    if (ordenacaoPedidos !== 'prioridade') {
      const opcao = ORDENACAO_PEDIDOS_OPTIONS.find((item) => item.id === ordenacaoPedidos);
      if (opcao) {
        ativos.push(`Ordenação: ${opcao.label}`);
      }
    }

    return ativos;
  }, [buscaPedidosOperacional, filtroPedidoPagamento, filtroPedidoStatus, ordenacaoPedidos]);

  const pedidosFiltradosOperacionais = useMemo(() => {
    const termoBusca = normalizarTextoBusca(buscaPedidosOperacional);

    const filtrados = pedidosOperacionais.filter((pedido) => {
      if (filtroPedidoStatus === 'criticos' && !pedido.critico) {
        return false;
      }

      if (filtroPedidoStatus !== 'todos' && filtroPedidoStatus !== 'criticos' && pedido.statusNormalizado !== filtroPedidoStatus) {
        return false;
      }

      if (filtroPedidoPagamento === 'confirmado' && pedido.pagamentoMeta.tone !== 'ok') {
        return false;
      }

      if (filtroPedidoPagamento === 'pendente' && !['waiting', 'attention'].includes(pedido.pagamentoMeta.tone)) {
        return false;
      }

      if (filtroPedidoPagamento === 'falhou' && pedido.pagamentoMeta.tone !== 'error') {
        return false;
      }

      if (filtroPedidoPagamento === 'pix' && pedido.formaPagamento !== 'pix') {
        return false;
      }

      if (filtroPedidoPagamento === 'cartao' && !['credito', 'debito', 'cartao'].includes(pedido.formaPagamento)) {
        return false;
      }

      if (filtroPedidoPagamento === 'dinheiro' && pedido.formaPagamento !== 'dinheiro') {
        return false;
      }

      if (termoBusca && !pedido.indiceBusca.includes(termoBusca)) {
        return false;
      }

      return true;
    });

    return filtrados.sort((a, b) => {
      if (ordenacaoPedidos === 'urgencia') {
        if (a.envelhecimentoNivel !== b.envelhecimentoNivel) {
          return b.envelhecimentoNivel - a.envelhecimentoNivel;
        }

        if (a.tempoDesdeCriacaoMinutos !== b.tempoDesdeCriacaoMinutos) {
          return b.tempoDesdeCriacaoMinutos - a.tempoDesdeCriacaoMinutos;
        }

        if (a.requerAcao !== b.requerAcao) {
          return Number(b.requerAcao) - Number(a.requerAcao);
        }

        return b.dataMs - a.dataMs;
      }

      if (ordenacaoPedidos === 'mais-recentes') {
        return b.dataMs - a.dataMs;
      }

      if (ordenacaoPedidos === 'mais-antigos') {
        return a.dataMs - b.dataMs;
      }

      if (ordenacaoPedidos === 'maior-valor') {
        return b.totalNumero - a.totalNumero;
      }

      if (ordenacaoPedidos === 'menor-valor') {
        return a.totalNumero - b.totalNumero;
      }

      const prioridadeA = a.statusNormalizado === 'cancelado'
        ? 4
        : (a.statusNormalizado === 'entregue' ? 3 : (a.critico ? 0 : 1));
      const prioridadeB = b.statusNormalizado === 'cancelado'
        ? 4
        : (b.statusNormalizado === 'entregue' ? 3 : (b.critico ? 0 : 1));

      if (prioridadeA !== prioridadeB) {
        return prioridadeA - prioridadeB;
      }

      if (a.requerAcao !== b.requerAcao) {
        return Number(b.requerAcao) - Number(a.requerAcao);
      }

      return b.dataMs - a.dataMs;
    });
  }, [
    buscaPedidosOperacional,
    filtroPedidoPagamento,
    filtroPedidoStatus,
    ordenacaoPedidos,
    pedidosOperacionais
  ]);

  const contadorPedidosOperacionaisTexto = useMemo(() => {
    if (paginacaoPedidos.total > 0) {
      return `${pedidosFiltradosOperacionais.length} de ${paginacaoPedidos.total} pedido(s)`;
    }

    return `${pedidosFiltradosOperacionais.length} pedido(s)`;
  }, [pedidosFiltradosOperacionais.length, paginacaoPedidos.total]);

  const ultimaAtualizacaoPedidosTexto = useMemo(() => {
    if (!ultimaAtualizacaoPedidosEm) {
      return 'Ainda sem atualização concluída nesta sessão.';
    }

    return `${formatarDataHoraOperacional(ultimaAtualizacaoPedidosEm)} (${formatarTempoRelativo(ultimaAtualizacaoPedidosEm)})`;
  }, [ultimaAtualizacaoPedidosEm]);

  const semPedidosOperacionais = pedidosOperacionais.length === 0;
  const semResultadosPedidosOperacionais = !semPedidosOperacionais && pedidosFiltradosOperacionais.length === 0;

  const navegacaoPedidosDetalhe = useMemo(() => {
    const ids = pedidosFiltradosOperacionais
      .map((pedido) => Number(pedido?.id || 0))
      .filter((id) => Number.isInteger(id) && id > 0);
    const atualId = Number(pedidoExpandidoId || 0);
    const indiceAtual = atualId > 0 ? ids.indexOf(atualId) : -1;

    return {
      total: ids.length,
      indiceAtual,
      anteriorId: indiceAtual > 0 ? ids[indiceAtual - 1] : null,
      proximoId: indiceAtual >= 0 && indiceAtual < ids.length - 1 ? ids[indiceAtual + 1] : null
    };
  }, [pedidoExpandidoId, pedidosFiltradosOperacionais]);

  const resumoAuditoriaSessao = useMemo(() => {
    const resumo = {
      total: historicoAcoesSessao.length,
      success: 0,
      error: 0,
      info: 0,
      ultimaAcao: historicoAcoesSessao[0] || null
    };

    historicoAcoesSessao.forEach((item) => {
      const tipo = String(item?.tipo || 'info');
      if (tipo === 'success') {
        resumo.success += 1;
      } else if (tipo === 'error') {
        resumo.error += 1;
      } else {
        resumo.info += 1;
      }
    });

    return resumo;
  }, [historicoAcoesSessao]);

  const ultimasAcoesSessaoVisiveis = useMemo(() => {
    return historicoAcoesSessao.slice(0, 3);
  }, [historicoAcoesSessao]);

  const financeiro = useMemo(() => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const pedidosComData = pedidos.map((pedido) => {
      const dataRaw = pedido.criado_em || pedido.data_pedido || null;
      const data = dataRaw ? new Date(dataRaw) : null;
      const total = Number(pedido.total || 0);
      return { ...pedido, _data: data, _total: total };
    });

    const pedidosValidos = pedidosComData.filter((pedido) => pedido.status !== 'cancelado');
    const pedidosHoje = pedidosValidos.filter((pedido) => pedido._data && pedido._data >= inicioHoje);
    const pedidosMes = pedidosValidos.filter((pedido) => pedido._data && pedido._data >= inicioMes);
    const pedidosCancelados = pedidosComData.filter((pedido) => pedido.status === 'cancelado');
    const pendentes = pedidosComData.filter((pedido) => pedido.status === 'pendente');

    const faturamentoTotal = pedidosValidos.reduce((acc, pedido) => acc + pedido._total, 0);
    const faturamentoHoje = pedidosHoje.reduce((acc, pedido) => acc + pedido._total, 0);
    const faturamentoMes = pedidosMes.reduce((acc, pedido) => acc + pedido._total, 0);
    const ticketMedio = pedidosValidos.length > 0 ? faturamentoTotal / pedidosValidos.length : 0;

    return {
      pedidosComData,
      faturamentoTotal,
      faturamentoHoje,
      faturamentoMes,
      ticketMedio,
      canceladosTotal: pedidosCancelados.reduce((acc, pedido) => acc + pedido._total, 0),
      pendentesTotal: pendentes.reduce((acc, pedido) => acc + pedido._total, 0)
    };
  }, [pedidos]);

  const linhasFinanceiro = useMemo(() => {
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioSemana = new Date(inicioHoje);
    inicioSemana.setDate(inicioHoje.getDate() - 6);
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

    const textoBusca = filtroFinanceiroBusca.trim().toLowerCase();

    const resultado = financeiro.pedidosComData.filter((pedido) => {
      if (filtroFinanceiroStatus !== 'todos' && pedido.status !== filtroFinanceiroStatus) {
        return false;
      }

      if (filtroFinanceiroPeriodo === 'hoje') {
        if (!pedido._data || pedido._data < inicioHoje) {
          return false;
        }
      }

      if (filtroFinanceiroPeriodo === 'semana') {
        if (!pedido._data || pedido._data < inicioSemana) {
          return false;
        }
      }

      if (filtroFinanceiroPeriodo === 'mes') {
        if (!pedido._data || pedido._data < inicioMes) {
          return false;
        }
      }

      if (filtroFinanceiroPeriodo === 'custom') {
        const inicio = filtroFinanceiroInicio ? new Date(`${filtroFinanceiroInicio}T00:00:00`) : null;
        const fim = filtroFinanceiroFim ? new Date(`${filtroFinanceiroFim}T23:59:59`) : null;
        if (inicio && (!pedido._data || pedido._data < inicio)) {
          return false;
        }
        if (fim && (!pedido._data || pedido._data > fim)) {
          return false;
        }
      }

      if (textoBusca) {
        const cliente = String(pedido.cliente_nome || '').toLowerCase();
        const idPedido = String(pedido.id || '');
        if (!cliente.includes(textoBusca) && !idPedido.includes(textoBusca)) {
          return false;
        }
      }

      return true;
    });

    return resultado.sort((a, b) => {
      if (filtroFinanceiroOrdem === 'valor_desc') {
        return Number(b._total || 0) - Number(a._total || 0);
      }
      if (filtroFinanceiroOrdem === 'valor_asc') {
        return Number(a._total || 0) - Number(b._total || 0);
      }
      if (filtroFinanceiroOrdem === 'data_asc') {
        return (a._data?.getTime() || 0) - (b._data?.getTime() || 0);
      }
      return (b._data?.getTime() || 0) - (a._data?.getTime() || 0);
    });
  }, [
    financeiro.pedidosComData,
    filtroFinanceiroStatus,
    filtroFinanceiroPeriodo,
    filtroFinanceiroBusca,
    filtroFinanceiroOrdem,
    filtroFinanceiroInicio,
    filtroFinanceiroFim
  ]);

  const resumoFinanceiroFiltrado = useMemo(() => {
    const validos = linhasFinanceiro.filter((pedido) => pedido.status !== 'cancelado');
    const total = validos.reduce((acc, pedido) => acc + Number(pedido._total || 0), 0);
    const ticket = validos.length ? total / validos.length : 0;
    return {
      quantidade: linhasFinanceiro.length,
      faturamento: total,
      ticket
    };
  }, [linhasFinanceiro]);

  function registrarAcaoSessao({ tipo = 'info', mensagem = '', pedidoId = null }) {
    const mensagemLimpa = String(mensagem || '').trim();
    if (!mensagemLimpa) {
      return;
    }

    const tipoNormalizado = ['success', 'error', 'info'].includes(tipo) ? tipo : 'info';
    const pedidoIdNumero = Number(pedidoId || 0);

    setHistoricoAcoesSessao((atual) => [
      {
        tipo: tipoNormalizado,
        mensagem: mensagemLimpa,
        pedidoId: Number.isInteger(pedidoIdNumero) && pedidoIdNumero > 0 ? pedidoIdNumero : null,
        em: Date.now()
      },
      ...atual
    ].slice(0, OPERACAO_PEDIDOS_LIMITES.historicoSessaoMaxItens));
  }

  async function salvarStatusPedido(pedidoId, statusForcado = '', origemAcao = 'manual') {
    const statusSelecionado = String(statusForcado || statusDraft[pedidoId] || '').trim().toLowerCase();

    if (!STATUS_OPTIONS.includes(statusSelecionado)) {
      setFeedbackPedidos({
        tipo: 'error',
        mensagem: 'Status inválido para este pedido.'
      });
      registrarAcaoSessao({
        tipo: 'error',
        mensagem: `Pedido #${pedidoId}: tentativa com status inválido.`,
        pedidoId
      });
      return;
    }

    setErro('');
    setAtualizandoStatusPedidoId(pedidoId);
    setFeedbackPedidos({ tipo: '', mensagem: '' });

    try {
      await adminAtualizarStatusPedido(pedidoId, statusSelecionado);

      setStatusDraft((atual) => ({
        ...atual,
        [pedidoId]: statusSelecionado
      }));

      const mensagemAcao = origemAcao === 'proximo'
        ? `Movido para ${formatarStatusPedido(statusSelecionado)}`
        : `Status salvo como ${formatarStatusPedido(statusSelecionado)}`;

      setFeedbackPedidos({
        tipo: 'success',
        mensagem: `Pedido #${pedidoId}: ${mensagemAcao}.`
      });

      registrarAcaoSessao({
        tipo: 'success',
        mensagem: `Pedido #${pedidoId}: ${mensagemAcao}.`,
        pedidoId
      });

      setUltimasAcoesPedidos((atual) => ({
        ...atual,
        [pedidoId]: {
          tipo: 'success',
          mensagem: mensagemAcao,
          em: Date.now()
        }
      }));

      await carregarPedidosPagina(paginacaoPedidos.pagina);
    } catch (error) {
      setErro(error.message);
      setFeedbackPedidos({
        tipo: 'error',
        mensagem: error.message || 'Falha ao atualizar status do pedido.'
      });
      registrarAcaoSessao({
        tipo: 'error',
        mensagem: `Pedido #${pedidoId}: ${error.message || 'falha ao atualizar status'}.`,
        pedidoId
      });
    } finally {
      setAtualizandoStatusPedidoId(null);
    }
  }

  async function handleAcaoRapidaPedido(pedido) {
    const statusAtual = String(pedido?.statusNormalizado || pedido?.status || '').trim().toLowerCase();
    const proximoStatus = obterProximoStatusPedido(statusAtual);

    if (!proximoStatus) {
      return;
    }

    await salvarStatusPedido(Number(pedido?.id), proximoStatus, 'proximo');
  }

  function toggleDetalhePedidoOperacional(pedidoId) {
    setPedidoExpandidoId((atual) => {
      const atualId = Number(atual || 0);
      const proximoId = Number(pedidoId || 0);
      if (!proximoId) {
        return null;
      }
      return atualId === proximoId ? null : proximoId;
    });
  }

  function abrirPrimeiroPedidoPrioritario() {
    const alvo = pedidosFiltradosOperacionais.find((pedido) =>
      pedido.critico || pedido.pendenciasOperacionais.length > 0 || pedido.requerAcao
    );

    if (!alvo) {
      setFeedbackPedidos({
        tipo: 'info',
        mensagem: 'Sem pedidos críticos com os filtros atuais.'
      });
      registrarAcaoSessao({
        tipo: 'info',
        mensagem: 'Busca de crítico sem resultado com os filtros atuais.'
      });
      return;
    }

    setPedidoExpandidoId(Number(alvo.id));
    registrarAcaoSessao({
      tipo: 'info',
      mensagem: `Pedido #${alvo.id} aberto para prioridade operacional.`,
      pedidoId: alvo.id
    });
  }

  function navegarDetalhePedidoOperacional(direcao) {
    const proximoId = direcao < 0
      ? navegacaoPedidosDetalhe.anteriorId
      : navegacaoPedidosDetalhe.proximoId;

    if (!proximoId) {
      return;
    }

    setPedidoExpandidoId(proximoId);
  }

  function limparFiltrosPedidosOperacionais() {
    setFiltroPedidoStatus('todos');
    setFiltroPedidoPagamento('todos');
    setOrdenacaoPedidos('prioridade');
    setBuscaPedidosOperacional('');
    setFeedbackPedidos({
      tipo: 'info',
      mensagem: 'Filtros da fila redefinidos.'
    });
    registrarAcaoSessao({
      tipo: 'info',
      mensagem: 'Filtros da fila redefinidos.'
    });
  }

  async function atualizarPedidosOperacionaisAgora() {
    const sucesso = await carregarPedidosPagina(paginacaoPedidos.pagina, { detectarNovos: true });

    if (sucesso) {
      setFeedbackPedidos({
        tipo: 'info',
        mensagem: 'Fila atualizada.'
      });
      registrarAcaoSessao({
        tipo: 'info',
        mensagem: 'Fila atualizada manualmente.'
      });
    }
  }

  function limparAvisoNovosPedidos() {
    setNovosPedidosDetectados(0);
  }

  function handleToggleModoFilaAlta(ativo) {
    setModoFilaAltaAtivo(ativo);

    const mensagem = ativo
      ? 'Fila alta ativada: mais pedidos por tela.'
      : 'Fila alta desativada: visão completa restaurada.';

    setFeedbackPedidos({ tipo: 'info', mensagem });
    registrarAcaoSessao({ tipo: 'info', mensagem });
  }

  function limparHistoricoAuditoriaSessao() {
    setHistoricoAcoesSessao([]);
    setFeedbackPedidos({
      tipo: 'info',
      mensagem: 'Histórico da sessão limpo.'
    });
  }

  async function handleCopiarCampoPedido(valor, label) {
    if (!valor) {
      setFeedbackPedidos({
        tipo: 'error',
        mensagem: `${label} indisponível.`
      });
      registrarAcaoSessao({
        tipo: 'error',
        mensagem: `${label} indisponível.`
      });
      return;
    }

    try {
      await copiarTextoNavegador(valor);
      setFeedbackPedidos({
        tipo: 'success',
        mensagem: `${label} copiado.`
      });
      registrarAcaoSessao({
        tipo: 'success',
        mensagem: `${label} copiado.`
      });
    } catch {
      setFeedbackPedidos({
        tipo: 'error',
        mensagem: `Não foi possível copiar ${label.toLowerCase()}.`
      });
      registrarAcaoSessao({
        tipo: 'error',
        mensagem: `Não foi possível copiar ${label.toLowerCase()}.`
      });
    }
  }

  async function handleCopiarResumoPedido(pedido) {
    await handleCopiarCampoPedido(
      montarResumoOperacionalPedido(pedido),
      `Resumo do pedido #${pedido?.id || ''}`
    );
  }

  async function handleCadastrarProduto(event) {
    event.preventDefault();
    setErro('');

    if (!produtoForm.nome || !produtoForm.preco || !produtoForm.categoria) {
      setErro('Preencha nome, preço e categoria para cadastrar o produto.');
      return;
    }

    setSalvandoProduto(true);
    try {
      await adminCadastrarProduto({
        codigo_barras: produtoForm.codigo_barras.trim(),
        nome: produtoForm.nome.trim(),
        descricao: produtoForm.descricao.trim(),
        marca: produtoForm.marca.trim(),
        imagem: produtoForm.imagem.trim(),
        preco: Number(produtoForm.preco),
        unidade: produtoForm.unidade.trim() || 'un',
        categoria: produtoForm.categoria.trim(),
        emoji: produtoForm.emoji.trim() || '📦',
        estoque: Number(produtoForm.estoque || 0)
      });

      setProdutoForm(initialProduto);
      await carregarProdutosPagina(paginacaoProdutos.pagina);
    } catch (error) {
      setErro(error.message);
    } finally {
      setSalvandoProduto(false);
    }
  }

  async function handleExcluirProduto(produtoId) {
    const ok = window.confirm('Confirma a remoção deste produto do catálogo?');
    if (!ok) {
      return;
    }

    setErro('');
    try {
      await adminExcluirProduto(produtoId);
      await carregarProdutosPagina(paginacaoProdutos.pagina);
    } catch (error) {
      setErro(error.message);
    }
  }

  async function handleBuscarProdutoPorCodigoBarras() {
    setErro('');
    const codigo = String(produtoForm.codigo_barras || '').replace(/\D/g, '');

    if (codigo.length < 8) {
      setErro('Informe um código de barras válido (mínimo 8 dígitos).');
      return;
    }

    setBuscandoCodigo(true);
    try {
      const data = await adminBuscarProdutoPorCodigoBarras(codigo);
      const produto = data?.produto || {};
      setProdutoForm((atual) => ({
        ...atual,
        codigo_barras: produto.codigo_barras || codigo,
        nome: produto.nome || atual.nome,
        descricao: produto.descricao || atual.descricao,
        marca: produto.marca || atual.marca,
        imagem: produto.imagem || atual.imagem,
        categoria: produto.categoria || atual.categoria,
        emoji: produto.emoji || atual.emoji
      }));
    } catch (error) {
      setErro(error.message);
    } finally {
      setBuscandoCodigo(false);
    }
  }

  function exportarFinanceiroCsv() {
    const linhas = [
      ['Pedido', 'Data', 'Cliente', 'Status', 'Pagamento', 'Valor']
    ];

    linhasFinanceiro.forEach((pedido) => {
      const data = pedido._data ? pedido._data.toLocaleString('pt-BR') : '-';
      linhas.push([
        `#${pedido.id}`,
        data,
        pedido.cliente_nome || '-',
        pedido.status || '-',
        pedido.forma_pagamento || 'pix',
        Number(pedido._total || 0).toFixed(2)
      ]);
    });

    const csv = linhas.map((linha) => linha.map((campo) => `"${String(campo).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!isLocalHost) {
    return (
      <section className="page">
        <h1>Admin</h1>
        <p>O acesso administrativo está disponível apenas no computador da loja.</p>
      </section>
    );
  }

  if (adminAutenticado !== true) {
    return (
      <section className="page">
        <h1>Acesso administrativo</h1>
        <p>Informe suas credenciais para acessar o painel de gestão da loja.</p>

        <form className="form-box" onSubmit={handleAdminLogin}>
          <label className="field-label" htmlFor="admin-usuario">Usuário</label>
          <input
            id="admin-usuario"
            className="field-input"
            value={adminUsuario}
            onChange={(event) => setAdminUsuario(event.target.value)}
            required
          />

          <label className="field-label" htmlFor="admin-senha">Senha</label>
          <input
            id="admin-senha"
            className="field-input"
            type="password"
            value={adminSenha}
            onChange={(event) => setAdminSenha(event.target.value)}
            required
          />

          {erro ? <p className="error-text">{erro}</p> : null}

          <button className="btn-primary" type="submit" disabled={carregando}>
            {carregando ? 'Validando acesso...' : 'Entrar no painel'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>Painel administrativo</h1>
      <p>Gerencie pedidos, catálogo e indicadores operacionais da loja.</p>

      <div className="admin-kpis">
        <div className="kpi-card"><strong>Pedidos:</strong> {kpis.total}</div>
        <div className="kpi-card"><strong>Pendentes:</strong> {kpis.pendentes}</div>
        <div className="kpi-card"><strong>Em entrega:</strong> {kpis.emEntrega}</div>
        <div className="kpi-card"><strong>Faturamento:</strong> R$ {kpis.faturamento.toFixed(2)}</div>
      </div>

      {paginacaoPedidos.total > pedidos.length ? (
        <p className="muted-text" style={{ marginTop: '0.5rem' }}>
          Indicadores acima refletem os pedidos da página atual ({paginacaoPedidos.pagina}/{paginacaoPedidos.total_paginas}).
        </p>
      ) : null}

      <div className="auth-switch" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className={`auth-switch-btn ${tab === 'pedidos' ? 'active' : ''}`}
          onClick={() => setTab('pedidos')}
        >
          Pedidos
        </button>
        <button
          type="button"
          className={`auth-switch-btn ${tab === 'produtos' ? 'active' : ''}`}
          onClick={() => setTab('produtos')}
        >
          Produtos
        </button>
        <button
          type="button"
          className={`auth-switch-btn ${tab === 'financeiro' ? 'active' : ''}`}
          onClick={() => setTab('financeiro')}
        >
          Financeiro
        </button>
        <button
          type="button"
          className={`auth-switch-btn ${tab === 'importacao' ? 'active' : ''}`}
          onClick={() => setTab('importacao')}
        >
          Importação
        </button>
      </div>

      <button
        className="btn-primary"
        type="button"
        style={{ marginTop: '0.8rem' }}
        onClick={() => {
          void carregarTudo();
        }}
        disabled={carregando}
      >
        {carregando ? 'Atualizando dados...' : 'Atualizar dados'}
      </button>
      <button className="btn-secondary" type="button" style={{ marginTop: '0.8rem', marginLeft: '0.5rem' }} onClick={handleAdminLogout}>
        Encerrar sessão
      </button>

      {erro ? <p className="error-text">{erro}</p> : null}

      {tab === 'pedidos' ? (
        <>
          <section className={`admin-orders-panel ${modoFilaAltaAtivo ? 'is-fila-alta' : ''}`}>
            <div className="admin-orders-head">
              <div>
                <h2>Operação de pedidos</h2>
                <p>Triagem operacional para priorizar, executar e acompanhar a fila.</p>
              </div>

              <p className="admin-orders-head-meta">
                Página {paginacaoPedidos.pagina} de {paginacaoPedidos.total_paginas} • {paginacaoPedidos.total} pedido(s)
              </p>
            </div>

            <div className="admin-orders-summary-grid" aria-label="Resumo operacional dos pedidos">
              <article className="admin-orders-summary-card">
                <span>Total na página</span>
                <strong>{resumoPedidosOperacionais.total}</strong>
                <small>{contadorPedidosOperacionaisTexto}</small>
              </article>

              <article className="admin-orders-summary-card is-critical">
                <span>Pendências críticas</span>
                <strong>{resumoPedidosOperacionais.criticos}</strong>
                <small>Pedidos com atenção imediata</small>
              </article>

              <article className="admin-orders-summary-card">
                <span>Aguardando ação</span>
                <strong>{resumoPedidosOperacionais.aguardandoAcao}</strong>
                <small>Status que exigem operação</small>
              </article>

              <article className="admin-orders-summary-card">
                <span>Em andamento</span>
                <strong>{resumoPedidosOperacionais.emAndamento}</strong>
                <small>Pedidos em fluxo de preparação/entrega</small>
              </article>

              <article className="admin-orders-summary-card">
                <span>Concluídos hoje</span>
                <strong>{resumoPedidosOperacionais.concluidosHoje}</strong>
                <small>Entregues no dia atual</small>
              </article>

              <article className="admin-orders-summary-card">
                <span>Pagamento pendente</span>
                <strong>{resumoPedidosOperacionais.pendentesPagamento}</strong>
                <small>Com necessidade de conferência</small>
              </article>
            </div>

            <div className="admin-orders-refresh-strip" aria-label="Estado de atualização operacional">
              <div className="admin-orders-refresh-info">
                <p>
                  <strong>Última atualização:</strong> {ultimaAtualizacaoPedidosTexto}
                </p>
                {novosPedidosDetectados > 0 ? (
                  <div className="admin-orders-new-warning" role="status" aria-live="polite">
                    <span>{novosPedidosDetectados} novo(s) pedido(s) detectado(s) na atualização.</span>
                    <button className="btn-secondary" type="button" onClick={limparAvisoNovosPedidos}>
                      Dispensar aviso
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="admin-orders-refresh-actions">
                <label className="admin-orders-autorefresh-toggle" htmlFor="admin-orders-auto-refresh">
                  <input
                    id="admin-orders-auto-refresh"
                    type="checkbox"
                    checked={autoRefreshPedidosAtivo}
                    onChange={(event) => setAutoRefreshPedidosAtivo(event.target.checked)}
                  />
                  Autoatualizar a cada {AUTO_REFRESH_PEDIDOS_LABEL}
                </label>

                <label className="admin-orders-autorefresh-toggle" htmlFor="admin-orders-high-queue-mode">
                  <input
                    id="admin-orders-high-queue-mode"
                    type="checkbox"
                    checked={modoFilaAltaAtivo}
                    onChange={(event) => handleToggleModoFilaAlta(event.target.checked)}
                  />
                  Fila alta: mais pedidos por tela
                </label>

                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => {
                    void atualizarPedidosOperacionaisAgora();
                  }}
                  disabled={carregandoPedidos}
                >
                  {carregandoPedidos ? 'Atualizando...' : 'Sincronizar fila agora'}
                </button>
              </div>
            </div>

            <div className="admin-orders-quick-nav" aria-label="Navegação rápida entre pedidos">
              <p>
                {pedidoExpandidoId && navegacaoPedidosDetalhe.indiceAtual >= 0
                  ? `Detalhe aberto ${navegacaoPedidosDetalhe.indiceAtual + 1} de ${navegacaoPedidosDetalhe.total}`
                  : 'Nenhum detalhe aberto na fila'}
              </p>

              <div className="admin-orders-quick-nav-actions">
                <button className="btn-secondary" type="button" onClick={abrirPrimeiroPedidoPrioritario}>
                  Abrir pedido crítico
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => navegarDetalhePedidoOperacional(-1)}
                  disabled={!navegacaoPedidosDetalhe.anteriorId}
                >
                  Pedido anterior
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => navegarDetalhePedidoOperacional(1)}
                  disabled={!navegacaoPedidosDetalhe.proximoId}
                >
                  Próximo pedido
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setPedidoExpandidoId(null)}
                  disabled={!pedidoExpandidoId}
                >
                  Fechar detalhe
                </button>
              </div>
            </div>

            <div className="admin-orders-session-audit" aria-label="Auditoria da sessão operacional">
              <div className="admin-orders-session-audit-head">
                <p>
                  <strong>Histórico da sessão:</strong> {resumoAuditoriaSessao.total} ação(ões)
                </p>
                <small>
                  {resumoAuditoriaSessao.ultimaAcao
                    ? `Última: ${resumoAuditoriaSessao.ultimaAcao.mensagem} (${formatarTempoRelativo(resumoAuditoriaSessao.ultimaAcao.em)})`
                    : 'Sem ações registradas nesta sessão.'}
                </small>
              </div>

              <div className="admin-orders-session-audit-chips">
                <span className="admin-orders-session-audit-chip tone-success">Sucessos: {resumoAuditoriaSessao.success}</span>
                <span className="admin-orders-session-audit-chip tone-info">Avisos: {resumoAuditoriaSessao.info}</span>
                <span className="admin-orders-session-audit-chip tone-error">Falhas: {resumoAuditoriaSessao.error}</span>
              </div>

              {ultimasAcoesSessaoVisiveis.length > 0 ? (
                <ul className="admin-orders-session-audit-list" aria-label="Últimas ações da sessão">
                  {ultimasAcoesSessaoVisiveis.map((acao, index) => (
                    <li key={`sessao-acao-${acao.em}-${index}`}>
                      <span className={`admin-orders-session-audit-dot tone-${acao.tipo || 'info'}`} aria-hidden="true" />
                      <span>{acao.mensagem}</span>
                      <small>{formatarTempoRelativo(acao.em)}</small>
                    </li>
                  ))}
                </ul>
              ) : null}

              <button
                className="btn-secondary admin-orders-session-audit-clear"
                type="button"
                onClick={limparHistoricoAuditoriaSessao}
                disabled={resumoAuditoriaSessao.total === 0}
              >
                Limpar histórico da sessão
              </button>
            </div>

            <div className="admin-orders-filter-wrap" aria-label="Filtros operacionais">
              <div className="admin-orders-status-chips" role="tablist" aria-label="Filtrar pedidos por status">
                {statusChipsOperacionais.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`admin-orders-status-chip ${filtroPedidoStatus === chip.id ? 'active' : ''}`}
                    onClick={() => setFiltroPedidoStatus(chip.id)}
                    aria-pressed={filtroPedidoStatus === chip.id}
                  >
                    <span>{chip.label}</span>
                    <strong>{chip.count}</strong>
                  </button>
                ))}
              </div>

              <div className="admin-orders-filters-grid">
                <label className="admin-orders-search-field" htmlFor="admin-orders-search">
                  <span>Busca operacional</span>
                  <input
                    id="admin-orders-search"
                    className="field-input"
                    placeholder="Número, cliente ou telefone"
                    value={buscaPedidosOperacional}
                    onChange={(event) => setBuscaPedidosOperacional(event.target.value)}
                  />
                </label>

                <label className="admin-orders-select-field" htmlFor="admin-orders-payment-filter">
                  <span>Pagamento</span>
                  <select
                    id="admin-orders-payment-filter"
                    className="field-input"
                    value={filtroPedidoPagamento}
                    onChange={(event) => setFiltroPedidoPagamento(event.target.value)}
                  >
                    {FILTRO_PAGAMENTO_OPTIONS.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>{opcao.label}</option>
                    ))}
                  </select>
                </label>

                <label className="admin-orders-select-field" htmlFor="admin-orders-orderby">
                  <span>Ordenação</span>
                  <select
                    id="admin-orders-orderby"
                    className="field-input"
                    value={ordenacaoPedidos}
                    onChange={(event) => setOrdenacaoPedidos(event.target.value)}
                  >
                    {ORDENACAO_PEDIDOS_OPTIONS.map((opcao) => (
                      <option key={opcao.id} value={opcao.id}>{opcao.label}</option>
                    ))}
                  </select>
                </label>

                <button
                  className="btn-secondary admin-orders-clear-btn"
                  type="button"
                  onClick={limparFiltrosPedidosOperacionais}
                  disabled={filtrosPedidosAplicados.length === 0}
                >
                  Limpar filtros da fila
                </button>
              </div>

              {filtrosPedidosAplicados.length > 0 ? (
                <div className="admin-orders-active-filters" aria-label="Filtros ativos">
                  {filtrosPedidosAplicados.map((item) => (
                    <span key={item} className="admin-orders-active-filter">{item}</span>
                  ))}
                </div>
              ) : null}
            </div>

            {feedbackPedidos.mensagem ? (
              <div className={`admin-orders-feedback is-${feedbackPedidos.tipo || 'info'}`} role="status" aria-live="polite">
                {feedbackPedidos.mensagem}
              </div>
            ) : null}

            {carregandoPedidos && semPedidosOperacionais ? (
              <div className="orders-state-card" role="status" aria-live="polite">
                <div className="orders-empty-icon" aria-hidden="true">⏳</div>
                <p><strong>Atualizando pedidos operacionais...</strong></p>
                <p>Estamos carregando os pedidos mais recentes desta página.</p>
              </div>
            ) : erro && semPedidosOperacionais ? (
              <div className="orders-state-card is-filter-empty" role="alert">
                <div className="orders-empty-icon" aria-hidden="true">⚠️</div>
                <p><strong>Não foi possível carregar os pedidos agora.</strong></p>
                <p>Confira sua conexão e tente atualizar novamente.</p>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    void atualizarPedidosOperacionaisAgora();
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            ) : semPedidosOperacionais ? (
              <div className="orders-state-card is-filter-empty" role="status" aria-live="polite">
                <div className="orders-empty-icon" aria-hidden="true">📭</div>
                <p><strong>Sem pedidos nesta página no momento.</strong></p>
                <p>Assim que houver novas vendas, elas aparecerão aqui para acompanhamento operacional.</p>
              </div>
            ) : semResultadosPedidosOperacionais ? (
              <div className="orders-state-card is-filter-empty" role="status" aria-live="polite">
                <div className="orders-empty-icon" aria-hidden="true">🗂️</div>
                <p><strong>Nenhum pedido encontrado com os filtros aplicados.</strong></p>
                <p>Ajuste os filtros para visualizar pedidos de outros status, clientes ou pagamentos.</p>
              </div>
            ) : (
              <div className={`admin-orders-list ${modoFilaAltaAtivo ? 'is-fila-alta' : ''}`}>
                {pedidosFiltradosOperacionais.map((pedido) => {
                  const pedidoId = Number(pedido?.id || 0);
                  const statusSelecionado = String(statusDraft[pedidoId] || pedido.statusNormalizado || '').trim().toLowerCase() || 'pendente';
                  const opcoesStatus = STATUS_OPTIONS.includes(statusSelecionado)
                    ? STATUS_OPTIONS
                    : [statusSelecionado, ...STATUS_OPTIONS.filter((status) => status !== statusSelecionado)];
                  const detalheAberto = pedidoExpandidoId === pedidoId;
                  const emAtualizacao = atualizandoStatusPedidoId === pedidoId;
                  const podeSalvarStatus = STATUS_OPTIONS.includes(statusSelecionado);
                  const resumoOperacionalTexto = montarResumoOperacionalPedido(pedido);
                  const proximoStatusLabel = pedido.proximoStatus ? formatarStatusPedido(pedido.proximoStatus) : '';
                  const classeEnvelhecimento = pedido.envelhecimentoTone !== 'normal'
                    ? `is-aged-${pedido.envelhecimentoTone}`
                    : '';
                  const pedidoTemPendencias = pedido.pendenciasOperacionais.length > 0;
                  const pendenciasVisiveis = modoFilaAltaAtivo
                    ? pedido.pendenciasOperacionais.slice(0, OPERACAO_PEDIDOS_LIMITES.maxPendenciasVisiveisFilaAlta)
                    : pedido.pendenciasOperacionais;
                  const pendenciasOcultas = Math.max(0, pedido.pendenciasOperacionais.length - pendenciasVisiveis.length);
                  const ultimaAcaoPedido = ultimasAcoesPedidos[pedidoId] || null;

                  return (
                    <article
                      key={pedidoId}
                      className={`admin-order-card ${pedido.critico ? 'is-critical' : ''} ${pedido.urgente ? 'is-urgent' : ''} ${classeEnvelhecimento} ${modoFilaAltaAtivo ? 'is-fila-alta' : ''}`}
                    >
                      <div
                        className="admin-order-card-head"
                        onDoubleClick={() => toggleDetalhePedidoOperacional(pedidoId)}
                        title="Duplo clique para abrir ou recolher detalhe"
                      >
                        <div>
                          <p className="admin-order-id">Pedido #{pedidoId}</p>
                          <p className="admin-order-date">{pedido.dataLabel}</p>
                          <div className="admin-order-time-meta">
                            <span className={`admin-order-time-chip tone-${pedido.envelhecimentoTone}`}>
                              Criado: {pedido.tempoDesdeCriacaoLabel}
                            </span>
                            {!modoFilaAltaAtivo && pedido.tempoNoStatusDisponivel ? (
                              <span className="admin-order-time-chip">No status: {pedido.tempoNoStatusLabel}</span>
                            ) : !modoFilaAltaAtivo ? (
                              <span className="admin-order-time-chip is-muted">No status: sem histórico dedicado</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="admin-order-badges">
                          {pedido.envelhecimentoLabel ? (
                            <span className={`admin-order-urgency tone-${pedido.envelhecimentoTone}`}>{pedido.envelhecimentoLabel}</span>
                          ) : null}

                          <span className={`admin-payment-badge tone-${pedido.pagamentoMeta.tone}`}>
                            {pedido.pagamentoMeta.label}
                          </span>

                          <span className={`orders-status-badge tone-${pedido.statusMeta.tone}`}>
                            <span className="orders-status-icon" aria-hidden="true">{pedido.statusMeta.icon}</span>
                            <span>{pedido.statusMeta.label}</span>
                          </span>
                        </div>
                      </div>

                      {pedidoTemPendencias ? (
                        <div className="admin-order-pendencias" aria-label="Pendências operacionais">
                          {pendenciasVisiveis.map((pendencia) => (
                            <span
                              key={`${pedidoId}-${pendencia.id}`}
                              className={`admin-order-pendencia-chip tone-${pendencia.tone}`}
                            >
                              {pendencia.label}
                            </span>
                          ))}
                          {pendenciasOcultas > 0 ? (
                            <span className="admin-order-pendencia-chip tone-muted">+{pendenciasOcultas} pendência(s)</span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="admin-order-grid">
                        <div>
                          <span>Cliente</span>
                          <strong>{pedido.clienteNome}</strong>
                          <small>{pedido.clienteTelefone || 'Telefone não informado'}</small>
                        </div>

                        <div>
                          <span>Total</span>
                          <strong>{formatarMoeda(pedido.totalNumero)}</strong>
                          <small>{pedido.totalItens} item(ns)</small>
                        </div>

                        <div>
                          <span>Atendimento</span>
                          <strong>{pedido.tipoAtendimento}</strong>
                          <small>{pedido.formaPagamentoLabel}</small>
                        </div>
                      </div>

                      <div className="admin-order-mid-row">
                        <p className="admin-order-summary">{pedido.resumoItensTexto}</p>

                        <div className="admin-order-tools-row">
                          <button
                            className="btn-secondary admin-order-util-btn"
                            type="button"
                            onClick={() => {
                              void handleCopiarCampoPedido(pedido.clienteTelefone, 'Telefone');
                            }}
                            disabled={!pedido.clienteTelefone}
                          >
                            Copiar telefone
                          </button>

                          {pedido.whatsappLink ? (
                            <a className="btn-secondary admin-order-util-btn" href={pedido.whatsappLink} target="_blank" rel="noopener noreferrer">
                              Abrir WhatsApp
                            </a>
                          ) : null}

                          <button
                            className="btn-secondary admin-order-util-btn"
                            type="button"
                            onClick={() => {
                              void handleCopiarCampoPedido(pedido.enderecoTexto, 'Endereço');
                            }}
                            disabled={!pedido.enderecoDisponivel}
                          >
                            Copiar endereço
                          </button>

                          <button
                            className="btn-secondary admin-order-util-btn"
                            type="button"
                            onClick={() => {
                              void handleCopiarResumoPedido(pedido);
                            }}
                            disabled={!resumoOperacionalTexto}
                          >
                            Copiar resumo
                          </button>
                        </div>
                      </div>

                      {ultimaAcaoPedido ? (
                        <p className={`admin-order-last-action tone-${ultimaAcaoPedido.tipo || 'info'}`}>
                          Última ação: {ultimaAcaoPedido.mensagem} ({formatarTempoRelativo(ultimaAcaoPedido.em)})
                        </p>
                      ) : null}

                      <div className="admin-order-actions-row">
                        {pedido.proximoStatus ? (
                          <button
                            className="btn-primary admin-order-next-step-btn"
                            type="button"
                            onClick={() => {
                              void handleAcaoRapidaPedido(pedido);
                            }}
                            disabled={emAtualizacao}
                          >
                            Avançar para {proximoStatusLabel}
                          </button>
                        ) : null}

                        <select
                          className="field-input"
                          value={statusSelecionado}
                          onChange={(event) =>
                            setStatusDraft((atual) => ({
                              ...atual,
                              [pedidoId]: event.target.value
                            }))
                          }
                          disabled={emAtualizacao}
                        >
                          {opcoesStatus.map((status) => (
                            <option key={`${pedidoId}-${status}`} value={status}>
                              {formatarStatusPedido(status)}
                              {!STATUS_OPTIONS.includes(status) ? ' (somente leitura)' : ''}
                            </option>
                          ))}
                        </select>

                        <button
                          className="btn-secondary admin-order-secondary-btn"
                          type="button"
                          onClick={() => {
                            void salvarStatusPedido(pedidoId);
                          }}
                          disabled={!podeSalvarStatus || emAtualizacao}
                        >
                          {emAtualizacao ? 'Salvando...' : 'Confirmar status'}
                        </button>

                        <button
                          className="btn-secondary admin-order-secondary-btn"
                          type="button"
                          onClick={() => toggleDetalhePedidoOperacional(pedidoId)}
                        >
                          {detalheAberto ? 'Fechar detalhe' : 'Abrir detalhe'}
                        </button>
                      </div>

                      {detalheAberto ? (
                        <div className="admin-order-details">
                          <div className="admin-order-details-layout">
                            <div className="admin-order-details-main">
                              <div className="admin-order-details-grid">
                                <article className="admin-order-detail-card">
                                  <h4>Pagamento</h4>
                                  <p>{pedido.pagamentoMeta.label}</p>
                                  <small>{pedido.pagamentoMeta.detalhe}</small>
                                  <small>Criado: {pedido.tempoDesdeCriacaoLabel}</small>
                                  <small>
                                    {pedido.tempoNoStatusDisponivel
                                      ? `No status atual: ${pedido.tempoNoStatusLabel}`
                                      : 'No status atual: sem histórico dedicado.'}
                                  </small>
                                  {pedido.pixStatus ? <small>PIX status: {pedido.pixStatus}</small> : null}
                                </article>

                                <article className="admin-order-detail-card">
                                  <h4>Contato</h4>
                                  <p>{pedido.clienteNome}</p>
                                  <small>{pedido.clienteTelefone || 'Telefone não informado'}</small>
                                  <div className="admin-order-detail-actions">
                                    <button
                                      className="btn-secondary"
                                      type="button"
                                      onClick={() => {
                                        void handleCopiarCampoPedido(pedido.clienteTelefone, 'Telefone');
                                      }}
                                    >
                                      Copiar telefone
                                    </button>
                                    {pedido.whatsappLink ? (
                                      <a className="btn-secondary" href={pedido.whatsappLink} target="_blank" rel="noopener noreferrer">
                                        Abrir WhatsApp
                                      </a>
                                    ) : null}
                                  </div>
                                </article>

                                <article className="admin-order-detail-card">
                                  <h4>Endereço</h4>
                                  <p>{pedido.enderecoTexto}</p>
                                  <div className="admin-order-detail-actions">
                                    <button
                                      className="btn-secondary"
                                      type="button"
                                      onClick={() => {
                                        void handleCopiarCampoPedido(pedido.enderecoTexto, 'Endereço');
                                      }}
                                      disabled={!pedido.enderecoDisponivel}
                                    >
                                      Copiar endereço
                                    </button>
                                  </div>
                                </article>

                                {pedido.observacaoOperacional ? (
                                  <article className="admin-order-detail-card is-highlight">
                                    <h4>Observação</h4>
                                    <p>{pedido.observacaoOperacional}</p>
                                  </article>
                                ) : null}
                              </div>

                              {pedido.statusNormalizado === 'cancelado' ? (
                                <div className="orders-timeline is-canceled is-compact">
                                  <span className="orders-timeline-canceled-text">Pedido cancelado.</span>
                                </div>
                              ) : (
                                <div className="orders-timeline is-compact" aria-label="Andamento operacional do pedido">
                                  {TIMELINE_ETAPAS_ADMIN.map((etapa, index) => {
                                    const numeroEtapa = index + 1;
                                    const done = numeroEtapa < pedido.statusMeta.timelineStep;
                                    const current = numeroEtapa === pedido.statusMeta.timelineStep;

                                    return (
                                      <div
                                        className={`orders-timeline-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
                                        key={`${pedidoId}-timeline-${etapa}`}
                                      >
                                        <span className="orders-timeline-dot" aria-hidden="true" />
                                        <span className="orders-timeline-label">{etapa}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="admin-order-details-side">
                              <div className="admin-order-items-box">
                                <div className="admin-order-items-head">
                                  <strong>Itens do pedido</strong>
                                  <span>{pedido.totalItens} item(ns)</span>
                                </div>

                                {pedido.itensLista.length === 0 ? (
                                  <p className="muted-text">Itens não detalhados neste pedido.</p>
                                ) : (
                                  <ul className="admin-order-items-list">
                                    {pedido.itensLista.map((item) => (
                                      <li key={`${pedidoId}-${item.id}`}>
                                        <div>
                                          <p>{item.nome}</p>
                                          <small>{item.quantidade} x {formatarMoeda(item.preco)}</small>
                                        </div>
                                        <strong>{formatarMoeda(item.subtotal)}</strong>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="toolbar-box admin-orders-pagination" style={{ alignItems: 'center' }}>
              <p className="muted-text" style={{ margin: 0 }}>
                {contadorPedidosOperacionaisTexto}
              </p>
              <button
                className="btn-secondary"
                type="button"
                disabled={carregandoPedidos || paginacaoPedidos.pagina <= 1}
                onClick={() => {
                  void carregarPedidosPagina(paginacaoPedidos.pagina - 1);
                }}
              >
                Página anterior
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={carregandoPedidos || !paginacaoPedidos.tem_mais}
                onClick={() => {
                  void carregarPedidosPagina(paginacaoPedidos.pagina + 1);
                }}
              >
                Próxima página
              </button>
            </div>

            {carregandoPedidos ? <p className="muted-text" style={{ marginTop: '0.2rem' }}>Atualizando pedidos...</p> : null}
          </section>
        </>
      ) : tab === 'produtos' ? (
        <>
          <form className="form-box" style={{ marginTop: '1rem' }} onSubmit={handleCadastrarProduto}>
            <p><strong>Cadastro de produto</strong></p>
            <div className="barcode-row">
              <input
                className="field-input"
                placeholder="Código de barras (EAN)"
                value={produtoForm.codigo_barras}
                onChange={(event) => setProdutoForm((atual) => ({ ...atual, codigo_barras: event.target.value }))}
              />
              <button
                className="btn-secondary"
                type="button"
                disabled={buscandoCodigo}
                onClick={handleBuscarProdutoPorCodigoBarras}
              >
                {buscandoCodigo ? 'Buscando...' : 'Buscar produto'}
              </button>
            </div>
            <input
              className="field-input"
              placeholder="Nome"
              value={produtoForm.nome}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, nome: event.target.value }))}
            />
            <textarea
              className="field-input"
              placeholder="Descrição"
              rows={3}
              value={produtoForm.descricao}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, descricao: event.target.value }))}
            />
            <input
              className="field-input"
              placeholder="Marca"
              value={produtoForm.marca}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, marca: event.target.value }))}
            />
            <input
              className="field-input"
              placeholder="URL da imagem"
              value={produtoForm.imagem}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, imagem: event.target.value }))}
            />
            {produtoForm.imagem ? (
              <img
                className="produto-preview-image"
                src={produtoForm.imagem}
                alt="Prévia do produto"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : null}
            <input
              className="field-input"
              placeholder="Preço"
              type="number"
              step="0.01"
              min="0"
              value={produtoForm.preco}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, preco: event.target.value }))}
            />
            <input
              className="field-input"
              placeholder="Categoria"
              value={produtoForm.categoria}
              onChange={(event) => setProdutoForm((atual) => ({ ...atual, categoria: event.target.value }))}
            />
            <div className="toolbar-box">
              <input
                className="field-input"
                placeholder="Unidade (ex: un, kg)"
                value={produtoForm.unidade}
                onChange={(event) => setProdutoForm((atual) => ({ ...atual, unidade: event.target.value }))}
              />
              <input
                className="field-input"
                placeholder="Emoji"
                value={produtoForm.emoji}
                onChange={(event) => setProdutoForm((atual) => ({ ...atual, emoji: event.target.value }))}
              />
              <input
                className="field-input"
                placeholder="Estoque"
                type="number"
                min="0"
                value={produtoForm.estoque}
                onChange={(event) => setProdutoForm((atual) => ({ ...atual, estoque: event.target.value }))}
              />
            </div>

            <button className="btn-primary" type="submit" disabled={salvandoProduto}>
              {salvandoProduto ? 'Salvando...' : 'Salvar produto'}
            </button>
          </form>

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {produtos.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhum produto cadastrado nesta página.</td>
                  </tr>
                ) : (
                  produtos.map((produto) => (
                    <tr key={produto.id}>
                      <td>{produto.id}</td>
                      <td>{produto.emoji || '📦'} {produto.nome}</td>
                      <td>{produto.categoria || '-'}</td>
                      <td>R$ {Number(produto.preco || 0).toFixed(2)}</td>
                      <td>{produto.estoque ?? 0}</td>
                      <td>
                        <button className="btn-secondary" type="button" onClick={() => handleExcluirProduto(produto.id)}>
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="toolbar-box" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
            <p className="muted-text" style={{ margin: 0 }}>
              Página {paginacaoProdutos.pagina} de {paginacaoProdutos.total_paginas} • {paginacaoProdutos.total} produto(s)
            </p>
            <button
              className="btn-secondary"
              type="button"
              disabled={carregandoProdutos || paginacaoProdutos.pagina <= 1}
              onClick={() => {
                void carregarProdutosPagina(paginacaoProdutos.pagina - 1);
              }}
            >
              Página anterior
            </button>
            <button
              className="btn-secondary"
              type="button"
              disabled={carregandoProdutos || !paginacaoProdutos.tem_mais}
              onClick={() => {
                void carregarProdutosPagina(paginacaoProdutos.pagina + 1);
              }}
            >
              Próxima página
            </button>
          </div>

          {carregandoProdutos ? <p className="muted-text" style={{ marginTop: '0.5rem' }}>Carregando produtos...</p> : null}
        </>
      ) : tab === 'financeiro' ? (
        <>
          <p className="muted-text" style={{ marginTop: '1rem' }}>
            Financeiro calculado com base nos pedidos da página atual ({paginacaoPedidos.pagina}/{paginacaoPedidos.total_paginas}).
          </p>

          <div className="toolbar-box" style={{ marginTop: '0.6rem', alignItems: 'center' }}>
            <button
              className="btn-secondary"
              type="button"
              disabled={carregandoPedidos || paginacaoPedidos.pagina <= 1}
              onClick={() => {
                void carregarPedidosPagina(paginacaoPedidos.pagina - 1);
              }}
            >
              Página anterior de pedidos
            </button>
            <button
              className="btn-secondary"
              type="button"
              disabled={carregandoPedidos || !paginacaoPedidos.tem_mais}
              onClick={() => {
                void carregarPedidosPagina(paginacaoPedidos.pagina + 1);
              }}
            >
              Próxima página de pedidos
            </button>
          </div>

          <div className="admin-kpis" style={{ marginTop: '1rem' }}>
            <div className="kpi-card"><strong>Faturamento total:</strong> R$ {financeiro.faturamentoTotal.toFixed(2)}</div>
            <div className="kpi-card"><strong>Faturamento hoje:</strong> R$ {financeiro.faturamentoHoje.toFixed(2)}</div>
            <div className="kpi-card"><strong>Faturamento mês:</strong> R$ {financeiro.faturamentoMes.toFixed(2)}</div>
            <div className="kpi-card"><strong>Ticket médio:</strong> R$ {financeiro.ticketMedio.toFixed(2)}</div>
            <div className="kpi-card"><strong>Pendentes:</strong> R$ {financeiro.pendentesTotal.toFixed(2)}</div>
            <div className="kpi-card"><strong>Cancelados:</strong> R$ {financeiro.canceladosTotal.toFixed(2)}</div>
          </div>

          <div className="admin-kpis" style={{ marginTop: '0.7rem' }}>
            <div className="kpi-card"><strong>Pedidos filtrados:</strong> {resumoFinanceiroFiltrado.quantidade}</div>
            <div className="kpi-card"><strong>Faturamento filtrado:</strong> R$ {resumoFinanceiroFiltrado.faturamento.toFixed(2)}</div>
            <div className="kpi-card"><strong>Ticket filtrado:</strong> R$ {resumoFinanceiroFiltrado.ticket.toFixed(2)}</div>
          </div>

          <div className="financeiro-actions">
            <select
              className="field-input"
              value={filtroFinanceiroPeriodo}
              onChange={(event) => setFiltroFinanceiroPeriodo(event.target.value)}
            >
              <option value="hoje">Hoje</option>
              <option value="semana">Últimos 7 dias</option>
              <option value="mes">Mês atual</option>
              <option value="todos">Todo período</option>
              <option value="custom">Período personalizado</option>
            </select>

            <select
              className="field-input"
              value={filtroFinanceiroStatus}
              onChange={(event) => setFiltroFinanceiroStatus(event.target.value)}
            >
              <option value="todos">Todos os status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{formatarStatusPedido(status)}</option>
              ))}
            </select>

            <select
              className="field-input"
              value={filtroFinanceiroOrdem}
              onChange={(event) => setFiltroFinanceiroOrdem(event.target.value)}
            >
              <option value="data_desc">Data mais recente</option>
              <option value="data_asc">Data mais antiga</option>
              <option value="valor_desc">Maior valor</option>
              <option value="valor_asc">Menor valor</option>
            </select>

            <input
              className="field-input"
              placeholder="Buscar cliente ou #pedido"
              value={filtroFinanceiroBusca}
              onChange={(event) => setFiltroFinanceiroBusca(event.target.value)}
            />

            <button className="btn-secondary" type="button" onClick={exportarFinanceiroCsv}>
              Exportar relatório (CSV)
            </button>
          </div>

          {filtroFinanceiroPeriodo === 'custom' ? (
            <div className="financeiro-actions" style={{ marginTop: '0.5rem' }}>
              <input
                className="field-input"
                type="date"
                value={filtroFinanceiroInicio}
                onChange={(event) => setFiltroFinanceiroInicio(event.target.value)}
              />
              <input
                className="field-input"
                type="date"
                value={filtroFinanceiroFim}
                onChange={(event) => setFiltroFinanceiroFim(event.target.value)}
              />
            </div>
          ) : null}

          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {linhasFinanceiro.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhum registro financeiro encontrado para os filtros aplicados.</td>
                  </tr>
                ) : (
                  linhasFinanceiro.map((pedido) => (
                    <tr key={pedido.id}>
                      <td>#{pedido.id}</td>
                      <td>{pedido._data ? pedido._data.toLocaleString('pt-BR') : '-'}</td>
                      <td>{pedido.cliente_nome || '-'}</td>
                      <td>{formatarStatusPedido(pedido.status)}</td>
                      <td>{pedido.forma_pagamento || 'pix'}</td>
                      <td>R$ {Number(pedido._total || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <form className="form-box" style={{ marginTop: '1rem' }} onSubmit={handleImportarPlanilha}>
            <p><strong>Importação de produtos por planilha</strong></p>
            <p className="muted-text">
              Importe arquivos do ERP em .xlsx ou .csv para atualizar preço, nome, descrição e foto.
            </p>

            <div
              className={`importacao-dropzone ${arrastandoImportacao ? 'dragover' : ''}`}
              onDragEnter={handleDragOverImportacao}
              onDragOver={handleDragOverImportacao}
              onDragLeave={handleDragLeaveImportacao}
              onDrop={handleDropImportacao}
            >
              <input
                id="admin-importacao-arquivo"
                className="importacao-file-input"
                type="file"
                accept=".xlsx,.csv"
                onChange={handleArquivoImportacaoChange}
              />

              <p><strong>Arraste e solte sua planilha aqui</strong></p>
              <p className="muted-text">ou clique no botão para selecionar um arquivo local.</p>

              <label htmlFor="admin-importacao-arquivo" className="btn-secondary importacao-select-btn">
                Selecionar arquivo
              </label>

              {arquivoImportacao ? (
                <p className="importacao-file-meta">
                  Arquivo selecionado: <strong>{arquivoImportacao.name}</strong> ({formatarTamanhoArquivo(arquivoImportacao.size)})
                </p>
              ) : (
                <p className="muted-text">Formatos aceitos: .xlsx e .csv</p>
              )}
            </div>

            <div className="toolbar-box importacao-toolbar">
              <label className="importacao-checkbox">
                <input
                  type="checkbox"
                  checked={importarCriarNovos}
                  onChange={(event) => setImportarCriarNovos(event.target.checked)}
                />
                Criar produtos novos automaticamente quando não existir correspondência por código.
              </label>

              <a
                className="btn-secondary importacao-modelo-btn"
                href={modeloImportacaoUrl}
                target="_blank"
                rel="noreferrer"
              >
                Baixar modelo CSV
              </a>
            </div>

            <div className="toolbar-box importacao-acoes-row" style={{ alignItems: 'center' }}>
              <button className="btn-secondary" type="button" disabled={importandoPlanilha} onClick={handleSimularPlanilha}>
                {importandoPlanilha ? 'Processando...' : 'Simular planilha'}
              </button>

              <button className="btn-primary" type="submit" disabled={importandoPlanilha}>
                {importandoPlanilha ? 'Importando planilha...' : 'Importar de verdade'}
              </button>
            </div>
          </form>

          {resultadoImportacao ? (
            <div className="card-box importacao-resumo-box" style={{ marginTop: '1rem' }}>
              <p>
                <strong>
                  {resultadoImportacao?.simulacao ? 'Resumo da última simulação' : 'Resumo da última importação'}
                </strong>
              </p>

              {resultadoImportacao?.simulacao ? (
                <p className="muted-text">
                  Esta prévia não altera o banco de dados. Use "Importar de verdade" para aplicar as mudanças.
                </p>
              ) : null}

              <div className="admin-kpis" style={{ marginTop: '0.5rem' }}>
                <div className="kpi-card"><strong>Total linhas:</strong> {Number(resultadoImportacao.total_linhas || 0)}</div>
                <div className="kpi-card"><strong>Atualizados:</strong> {Number(resultadoImportacao.total_atualizados || 0)}</div>
                <div className="kpi-card"><strong>Criados:</strong> {Number(resultadoImportacao.total_criados || 0)}</div>
                <div className="kpi-card"><strong>Ignorados:</strong> {Number(resultadoImportacao.total_ignorados || 0)}</div>
                <div className="kpi-card"><strong>Erros:</strong> {Number(resultadoImportacao.total_erros || 0)}</div>
              </div>

              <p className="muted-text">Arquivo: {resultadoImportacao.arquivo || '-'}</p>

              <p className="muted-text">
                Colunas mapeadas: {
                  Object.entries(resultadoImportacao.colunas_mapeadas || {})
                    .map(([chave, valor]) => `${chave}: ${valor}`)
                    .join(' | ') || 'Não informado'
                }
              </p>

              {Array.isArray(resultadoImportacao?.logs?.erros) && resultadoImportacao.logs.erros.length > 0 ? (
                <div className="importacao-log-box">
                  <p><strong>Erros identificados</strong></p>
                  <ul className="importacao-log-list">
                    {resultadoImportacao.logs.erros.slice(0, 8).map((item, index) => (
                      <li key={`erro-importacao-${index}`}>
                        Linha {item?.linha || '-'}: {item?.motivo || 'Erro sem detalhe.'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {Array.isArray(resultadoImportacao?.logs?.ignorados) && resultadoImportacao.logs.ignorados.length > 0 ? (
                <div className="importacao-log-box">
                  <p><strong>Itens ignorados</strong></p>
                  <ul className="importacao-log-list">
                    {resultadoImportacao.logs.ignorados.slice(0, 8).map((item, index) => (
                      <li key={`ignorado-importacao-${index}`}>
                        Linha {item?.linha || '-'}: {item?.motivo || 'Item ignorado sem detalhe.'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="card-box" style={{ marginTop: '1rem' }}>
            <div className="toolbar-box" style={{ alignItems: 'center' }}>
              <p style={{ margin: 0 }}><strong>Histórico de importações</strong></p>
              <button
                className="btn-secondary"
                type="button"
                disabled={carregandoImportacoes}
                onClick={() => {
                  void carregarHistoricoImportacoes();
                }}
              >
                {carregandoImportacoes ? 'Atualizando histórico...' : 'Atualizar histórico'}
              </button>
            </div>

            <div className="table-wrap" style={{ marginTop: '0.7rem' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Arquivo</th>
                    <th>Status</th>
                    <th>Atualizados</th>
                    <th>Criados</th>
                    <th>Ignorados</th>
                    <th>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoImportacoes.length === 0 ? (
                    <tr>
                      <td colSpan={7}>Nenhuma importação registrada até o momento.</td>
                    </tr>
                  ) : (
                    historicoImportacoes.map((importacao) => (
                      <tr key={importacao.id}>
                        <td>{importacao.criado_em ? new Date(importacao.criado_em).toLocaleString('pt-BR') : '-'}</td>
                        <td>{importacao.nome_arquivo || '-'}</td>
                        <td>
                          <span className={`importacao-status-badge status-${String(importacao.status || '').toLowerCase()}`}>
                            {formatarStatusImportacao(importacao.status)}
                          </span>
                        </td>
                        <td>{Number(importacao.total_atualizados || 0)}</td>
                        <td>{Number(importacao.total_criados || 0)}</td>
                        <td>{Number(importacao.total_ignorados || 0)}</td>
                        <td>{Number(importacao.total_erros || 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}