import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeX, CircleCheck, Clock3, FileText, FolderSearch, Package, Receipt, Search, ShieldCheck, Store, Wallet } from '../icons';
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
import { extrairMetricasTempoPedido, montarTimelineEtapas } from '../lib/metricasOperacionais';
import SmartImage from '../components/ui/SmartImage';
import DashboardExecutivo from '../components/admin/DashboardExecutivo';
import FilaOperacional from '../components/admin/FilaOperacional';
import ClientesAdmin from '../components/admin/ClientesAdmin';
import FinanceiroAvancado from '../components/admin/FinanceiroAvancado';
import AuditoriaAdmin from '../components/admin/AuditoriaAdmin';
import RelatoriosAdmin from '../components/admin/RelatoriosAdmin';
import AdminShell from '../components/admin/AdminShell';
import CommandCenter from '../components/admin/CommandCenter';
import CatalogoSaude from '../components/admin/CatalogoSaude';
import FinanceScreen from '../components/screens/FinanceScreen';
import ImportScreen from '../components/screens/ImportScreen';
import CatalogScreen from '../components/screens/CatalogScreen';
import OrdersScreen from '../components/screens/OrdersScreen';
import '../admin-dark-override.css';

const STATUS_OPTIONS = ['pendente', 'preparando', 'pronto_para_retirada', 'enviado', 'retirado', 'entregue', 'cancelado'];
const STATUS_LABELS = {
  aguardando_revisao: 'Em revisão',
  pendente: 'Aguardando confirmação',
  pagamento_recusado: 'Pagamento recusado',
  preparando: 'Separando',
  pronto_para_retirada: 'Preparado',
  enviado: 'Saiu pra Entrega',
  retirado: 'Retirado na loja',
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
  aguardando_revisao: {
    label: 'Em revisao',
    icon: Receipt,
    tone: 'waiting',
    timelineStep: 1
  },
  pendente: {
    label: 'Aguardando confirmacao',
    icon: Clock3,
    tone: 'waiting',
    timelineStep: 1
  },
  pagamento_recusado: {
    label: 'Pagamento recusado',
    icon: BadgeX,
    tone: 'canceled',
    timelineStep: 1
  },
  pago: {
    label: 'Pago',
    icon: Wallet,
    tone: 'processing',
    timelineStep: 2
  },
  preparando: {
    label: 'Separando',
    icon: Package,
    tone: 'preparing',
    timelineStep: 3
  },
  pronto_para_retirada: {
    label: 'Preparado',
    icon: CircleCheck,
    tone: 'pickup-ready',
    timelineStep: 4
  },
  enviado: {
    label: 'Saiu pra Entrega',
    icon: Package,
    tone: 'delivery',
    timelineStep: 4
  },
  retirado: {
    label: 'Retirado na loja',
    icon: Store,
    tone: 'pickup-done',
    timelineStep: 5
  },
  entregue: {
    label: 'Entregue',
    icon: CircleCheck,
    tone: 'delivered',
    timelineStep: 5
  },
  cancelado: {
    label: 'Cancelado',
    icon: BadgeX,
    tone: 'canceled',
    timelineStep: -1
  }
};
const STATUS_CHIPS_OPERACIONAIS = ['todos', 'criticos', 'aguardando_revisao', 'pendente', 'pagamento_recusado', 'pago', 'preparando', 'pronto_para_retirada', 'enviado', 'retirado', 'entregue', 'cancelado'];
const TIMELINE_ETAPAS_ADMIN = ['Recebido', 'Pago', 'Separando', 'Preparado', 'Entregue'];
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
const FILTRO_TIPO_ENTREGA_OPTIONS = [
  { id: 'todos', label: 'Atendimento: todos' },
  { id: 'entrega', label: 'Somente entrega' },
  { id: 'retirada', label: 'Somente retirada' }
];
const OPERACAO_PEDIDOS_LIMITES = Object.freeze({
  pendenteAtencaoMinutos: 20,
  envelhecimentoAtencaoMinutos: 45,
  envelhecimentoUrgenciaMinutos: 90,
  envelhecimentoCriticoMinutos: 180,
  muitosItensDistintos: 6,
  muitasUnidadesEstimadas: 12,
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
const FILTRO_TIPO_ENTREGA_SET = new Set(FILTRO_TIPO_ENTREGA_OPTIONS.map((item) => item.id));
const PEDIDOS_TAB_SOMENTE_HISTORICO = true;

// Som de notificação para novos pedidos (Web Audio API - sem arquivo externo)
function tocarSomNovoPedido() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notas = [830, 1050, 1250]; // 3 tons ascendentes
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
    // Liberar recursos após tocar
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch (_) {
    // Navegador pode bloquear audio sem interação prévia ? ignora silenciosamente
  }
}

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

function normalizarTipoEntregaPedido(tipoEntregaRaw, enderecoRaw) {
  const tipoEntrega = String(tipoEntregaRaw || '').trim().toLowerCase();
  if (tipoEntrega === 'retirada') {
    return 'retirada';
  }

  if (tipoEntrega === 'entrega') {
    return 'entrega';
  }

  const enderecoEhObjeto = Boolean(enderecoRaw && typeof enderecoRaw === 'object');
  const possuiEndereco = enderecoEhObjeto
    && [enderecoRaw?.rua, enderecoRaw?.logradouro, enderecoRaw?.cep].some((valor) => String(valor || '').trim().length > 0);

  return possuiEndereco ? 'entrega' : 'retirada';
}

function formatarTipoEntregaPedido(tipoEntregaRaw, enderecoRaw) {
  return normalizarTipoEntregaPedido(tipoEntregaRaw, enderecoRaw) === 'retirada'
    ? 'Retirada'
    : 'Entrega';
}

function obterMetaStatusOperacional(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_OPERACAO_META[status] || {
    label: 'Em analise',
    icon: Package,
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

  if (['entregue', 'retirado', 'cancelado'].includes(status)) {
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
    filtroTipoEntrega: 'todos',
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
    const filtroTipoEntrega = FILTRO_TIPO_ENTREGA_SET.has(String(salvo?.filtroTipoEntrega || ''))
      ? String(salvo.filtroTipoEntrega)
      : contextoPadrao.filtroTipoEntrega;
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
      filtroTipoEntrega,
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
  const tipoAtendimento = formatarTipoEntregaPedido(pedido?.tipoEntregaNormalizado || pedido?.tipo_entrega, pedido?.endereco);

  return [
    `Pedido #${pedido?.id || '-'}`,
    `Cliente: ${pedido?.clienteNome || '-'}`,
    `Telefone: ${pedido?.clienteTelefone || 'não informado'}`,
    `Total: ${formatarMoeda(pedido?.totalNumero || pedido?.total || 0)}`,
    `Status: ${pedido?.statusMeta?.label || formatarStatusPedido(pedido?.status || '')}`,
    `Atendimento: ${tipoAtendimento}`,
    `Pagamento: ${pedido?.pagamentoMeta?.label || '-'}${pagamentoDetalhe}`,
    `Endereço: ${tipoAtendimento === 'Retirada' ? 'Retirada na loja (sem entrega)' : (pedido?.enderecoTexto || 'não cadastrado')}`,
    `Itens principais: ${itensPrincipais}`
  ].join('\n');
}

function coletarTextosOperacionais(candidatosRaw) {
  const textos = [];
  const vistos = new Set();

  function adicionarTexto(valorRaw) {
    const texto = String(valorRaw || '').trim();
    if (!texto) {
      return;
    }

    const chave = normalizarTextoBusca(texto);
    if (vistos.has(chave)) {
      return;
    }

    vistos.add(chave);
    textos.push(texto);
  }

  function visitarValor(valor) {
    if (!valor && valor !== 0) {
      return;
    }

    if (Array.isArray(valor)) {
      valor.forEach(visitarValor);
      return;
    }

    if (typeof valor === 'object') {
      const chaves = ['nome', 'label', 'valor', 'descricao', 'detalhe', 'texto', 'observacao'];
      chaves.forEach((chave) => {
        if (Object.prototype.hasOwnProperty.call(valor, chave)) {
          visitarValor(valor[chave]);
        }
      });
      return;
    }

    adicionarTexto(valor);
  }

  (Array.isArray(candidatosRaw) ? candidatosRaw : [candidatosRaw]).forEach(visitarValor);
  return textos;
}

function extrairVariacaoItemOperacional(item) {
  return coletarTextosOperacionais([
    item?.variacao,
    item?.variacoes,
    item?.opcao,
    item?.opcoes,
    item?.complemento,
    item?.complementos,
    item?.adicionais,
    item?.sabor,
    item?.tamanho
  ]).join(' · ');
}

function extrairObservacaoItemOperacional(item) {
  return coletarTextosOperacionais([
    item?.observacao,
    item?.observacoes,
    item?.obs,
    item?.nota,
    item?.comentario,
    item?.instrucoes,
    item?.observacao_cliente
  ]).join(' · ');
}

function montarListaSeparacaoPedido(pedido) {
  const itens = Array.isArray(pedido?.itensLista) ? pedido.itensLista : [];
  const linhasItens = itens.length
    ? itens.map((item, index) => {
      const linhas = [`${index + 1}. ${item.quantidade}x ${item.nome}`];

      if (item.variacaoTexto) {
        linhas.push(`   Variação: ${item.variacaoTexto}`);
      }

      if (item.observacaoItem) {
        linhas.push(`   Obs item: ${item.observacaoItem}`);
      }

      return linhas.join('\n');
    }).join('\n')
    : 'Itens não detalhados neste pedido.';
  const observacoesRelevantes = Array.isArray(pedido?.observacoesRelevantesLista)
    ? pedido.observacoesRelevantesLista
    : [];

  return [
    `Separação do pedido #${pedido?.id || '-'}`,
    `Cliente: ${pedido?.clienteNome || '-'}`,
    `Itens distintos: ${Number(pedido?.totalItensDistintos || itens.length || 0)}`,
    `Unidades estimadas: ${Number(pedido?.totalUnidadesEstimadas || 0)}`,
    '',
    linhasItens,
    '',
    `Observações relevantes: ${observacoesRelevantes.length ? observacoesRelevantes.join(' | ') : 'nenhuma'}`
  ].join('\n');
}

function montarMensagemContatoOperacionalPedido(pedido) {
  const status = String(pedido?.statusMeta?.label || formatarStatusPedido(pedido?.status || '')).toLowerCase();
  const pagamento = String(pedido?.pagamentoMeta?.label || 'Pagamento não informado');
  const tipoEntrega = normalizarTipoEntregaPedido(pedido?.tipoEntregaNormalizado || pedido?.tipo_entrega, pedido?.endereco);
  const enderecoTexto = tipoEntrega === 'retirada'
    ? 'Retirada na loja confirmada.'
    : (pedido?.enderecoDisponivel ? 'Endereço confirmado.' : 'Endereço pendente.');
  const telefoneTexto = pedido?.clienteTelefone ? 'Telefone confirmado.' : 'Telefone pendente.';

  return `BomFilho: pedido #${pedido?.id || '-'} em ${status}. ${pagamento}. ${enderecoTexto} ${telefoneTexto} Responda se precisar ajustar dados.`;
}

function montarResumoConferenciaExpedicaoPedido(pedido, { modoFilaAlta = false } = {}) {
  const pagamentoDetalhe = pedido?.pagamentoMeta?.detalhe ? ` (${pedido.pagamentoMeta.detalhe})` : '';
  const tipoEntrega = normalizarTipoEntregaPedido(pedido?.tipoEntregaNormalizado || pedido?.tipo_entrega, pedido?.endereco);
  const alertas = [];

  if (pedido?.observacoesRelevantesCount > 0) {
    alertas.push('Observação do cliente presente');
  }

  if (['waiting', 'attention', 'error'].includes(String(pedido?.pagamentoMeta?.tone || '').trim().toLowerCase())) {
    alertas.push('Pagamento pendente/falha');
  }

  if (pedido?.possuiMuitosItens) {
    alertas.push('Separação volumosa');
  }

  if (pedido?.envelhecimentoLabel) {
    alertas.push(pedido.envelhecimentoLabel);
  }

  if (modoFilaAlta) {
    alertas.push('Fila alta ativa');
  }

  return [
    `Conferência de expedição #${pedido?.id || '-'}`,
    `Status atual: ${pedido?.statusMeta?.label || formatarStatusPedido(pedido?.status || '')}`,
    `Atendimento: ${formatarTipoEntregaPedido(tipoEntrega)}`,
    `Pagamento: ${pedido?.pagamentoMeta?.label || '-'}${pagamentoDetalhe}`,
    `Telefone: ${pedido?.clienteTelefone || 'não informado'}`,
    `Endereço: ${tipoEntrega === 'retirada' ? 'Retirada na loja (sem entrega)' : (pedido?.enderecoTexto || 'não cadastrado')}`,
    `Observação do cliente: ${pedido?.observacaoOperacional || 'sem observação'}`,
    `Itens: ${Number(pedido?.totalItensDistintos || 0)} distintos / ${Number(pedido?.totalUnidadesEstimadas || 0)} unidades`,
    `Atenções: ${alertas.length ? alertas.join(' | ') : 'sem alertas adicionais'}`
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
  observacaoOperacional,
  possuiMuitosItens
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

  if (possuiMuitosItens) {
    pendencias.push({
      id: 'separacao-volumosa',
      tone: 'attention',
      label: 'Separação volumosa'
    });
  }

  return pendencias.slice(0, 4);
}

function obterProximoStatusPedido(statusRaw, tipoEntregaRaw = 'entrega') {
  const status = String(statusRaw || '').trim().toLowerCase();
  const tipoEntrega = String(tipoEntregaRaw || '').trim().toLowerCase() === 'retirada' ? 'retirada' : 'entrega';

  if (status === 'pendente' || status === 'pago') {
    return 'preparando';
  }

  if (status === 'preparando') {
    return tipoEntrega === 'retirada' ? 'pronto_para_retirada' : 'enviado';
  }

  if (status === 'pronto_para_retirada') {
    return 'retirado';
  }

  if (status === 'enviado') {
    return 'entregue';
  }

  return null;
}

function obterLabelAcaoRapida(statusRaw, tipoEntregaRaw = 'entrega') {
  const status = String(statusRaw || '').trim().toLowerCase();
  const tipoEntrega = String(tipoEntregaRaw || '').trim().toLowerCase() === 'retirada' ? 'retirada' : 'entrega';

  if (status === 'pendente' || status === 'pago') {
    return 'Iniciar separação';
  }

  if (status === 'preparando') {
    return tipoEntrega === 'retirada' ? 'Marcar pronto para retirada' : 'Marcar saída';
  }

  if (status === 'pronto_para_retirada') {
    return 'Marcar retirado';
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
  const pagamentoRecusado = statusPedido === 'pagamento_recusado';

  if (statusPedido === 'cancelado') {
    return {
      tone: 'neutral',
      label: 'Pedido cancelado',
      detalhe: formaLabel
    };
  }

  if (pagamentoRecusado) {
    return {
      tone: 'error',
      label: 'Pagamento recusado',
      detalhe: forma === 'pix' && pixStatus ? `PIX ${pixStatus}` : formaLabel
    };
  }

  if (forma === 'pix') {
    if (pixStatus === 'PAID' || ['pago', 'preparando', 'pronto_para_retirada', 'enviado', 'retirado', 'entregue'].includes(statusPedido)) {
      return {
        tone: 'ok',
        label: 'Pagamento confirmado',
        detalhe: pixStatus ? `PIX ${pixStatus}` : 'PIX'
      };
    }

    if (['DECLINED', 'REJECTED', 'CANCELED', 'EXPIRED', 'FAILED'].includes(pixStatus)) {
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
    if (['pago', 'preparando', 'pronto_para_retirada', 'enviado', 'retirado', 'entregue'].includes(statusPedido)) {
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
  emoji: '',
  estoque: 0
};

export default function AdminPage() {
  const contextoPedidosInicial = useMemo(() => obterContextoPedidosOperacionaisInicial(), []);
  const [adminUsuario, setAdminUsuario] = useState('admin');
  const [adminSenha, setAdminSenha] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [codigo2FA, setCodigo2FA] = useState('');
  const [msg2FA, setMsg2FA] = useState('');
  const [adminAutenticado, setAdminAutenticado] = useState(null);
  const [tab, setTab] = useState('operacao');
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [paginacaoPedidos, setPaginacaoPedidos] = useState(() => criarPaginacaoInicial(ADMIN_PEDIDOS_POR_PAGINA));
  const [paginacaoProdutos, setPaginacaoProdutos] = useState(() => criarPaginacaoInicial(ADMIN_PRODUTOS_POR_PAGINA));
  const [statusDraft, setStatusDraft] = useState({});
  const [filtroPedidoStatus, setFiltroPedidoStatus] = useState(() => contextoPedidosInicial.filtroStatus);
  const [filtroPedidoPagamento, setFiltroPedidoPagamento] = useState(() => contextoPedidosInicial.filtroPagamento);
  const [filtroPedidoTipoEntrega, setFiltroPedidoTipoEntrega] = useState(() => contextoPedidosInicial.filtroTipoEntrega);
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
        // Request browser notification permission
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        } catch {}
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
      filtroTipoEntrega: filtroPedidoTipoEntrega,
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
    filtroPedidoTipoEntrega,
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
        if (idsNovos.length > 0) {
          tocarSomNovoPedido();
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('Novo pedido!', {
                body: `${idsNovos.length} pedido(s) novo(s) recebido(s)`,
                icon: '/img/icone_oficial.png',
              });
            }
          } catch {}
        }
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

      // Backend exige 2FA
      if (data?.requires2FA) {
        setNeeds2FA(true);
        setMsg2FA(data.mensagem || 'Código enviado.');
        setCodigo2FA('');
        return;
      }

      setAdminAutenticado(true);
      setNeeds2FA(false);
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

  async function handleVerify2FA(event) {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const { adminVerify2FA } = await import('../lib/api');
      const data = await adminVerify2FA(codigo2FA.trim());
      setAdminAutenticado(true);
      setNeeds2FA(false);
      setCodigo2FA('');
      setAdminSenha('');
      if (data?.usuario) {
        setAdminUsuario(String(data.usuario));
      }
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
    setFiltroPedidoTipoEntrega('todos');
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
      const tipoEntregaNormalizado = normalizarTipoEntregaPedido(pedido?.tipo_entrega, pedido?.endereco);
      const enderecoDisponivel = Boolean(pedido?.endereco && typeof pedido?.endereco === 'object' && pedido?.endereco?.rua);
      const enderecoTextoOperacional = tipoEntregaNormalizado === 'retirada'
        ? 'Retirada na loja (sem endereço de entrega).'
        : formatarEnderecoOperacional(pedido?.endereco);
      const observacaoOperacional = obterObservacaoOperacionalPedido(pedido);
      const telefoneCliente = String(pedido?.cliente_telefone || '').trim();
      const clienteNome = String(pedido?.cliente_nome || '').trim() || 'Cliente não identificado';
      const totalNumero = Number(pedido?.total || 0);
      const itensLista = Array.isArray(pedido?.itens)
        ? pedido.itens.map((item, index) => {
          const quantidade = Math.max(1, Number(item?.quantidade || 1));
          const preco = Number(item?.preco || 0);
          const subtotal = Number(item?.subtotal || (quantidade * preco));
          const variacaoTexto = extrairVariacaoItemOperacional(item);
          const observacaoItem = extrairObservacaoItemOperacional(item);

          return {
            id: Number(item?.id || 0) || `item-${pedido?.id}-${index}`,
            nome: String(item?.nome_produto || item?.nome || `Item ${index + 1}`).trim(),
            quantidade,
            preco,
            subtotal,
            variacaoTexto,
            observacaoItem
          };
        })
        : [];
      const totalItensDistintos = itensLista.length;
      const totalUnidadesEstimadas = itensLista.reduce((acc, item) => {
        const quantidade = Number(item?.quantidade || 0);
        return acc + (Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 1);
      }, 0);
      const observacoesItens = itensLista
        .map((item) => String(item?.observacaoItem || '').trim())
        .filter(Boolean);
      const observacoesRelevantesLista = [...new Set([
        String(observacaoOperacional || '').trim(),
        ...observacoesItens
      ].filter(Boolean))];
      const observacoesRelevantesCount = observacoesRelevantesLista.length;
      const possuiMuitosItens = totalItensDistintos >= OPERACAO_PEDIDOS_LIMITES.muitosItensDistintos
        || totalUnidadesEstimadas >= OPERACAO_PEDIDOS_LIMITES.muitasUnidadesEstimadas;
      const pagamentoRequerConferencia = ['waiting', 'attention', 'error'].includes(pagamentoMeta.tone);

      const requerAcao = ['aguardando_revisao', 'pendente', 'pagamento_recusado', 'pago', 'preparando', 'pronto_para_retirada', 'enviado'].includes(statusNormalizado);
      const envelhecimentoMeta = obterMetaEnvelhecimentoPedido(statusNormalizado, tempoMinutos, pagamentoMeta.tone);
      const proximoStatus = obterProximoStatusPedido(statusNormalizado, tipoEntregaNormalizado);
      const urgente = envelhecimentoMeta.nivel >= 2;
      const critico = envelhecimentoMeta.nivel >= 3 || ['aguardando_revisao', 'pendente', 'pagamento_recusado'].includes(statusNormalizado) || pagamentoMeta.tone === 'error';
      const tempoNoStatusDisponivel = Number.isFinite(tempoNoStatusMinutos) && tempoNoStatusMinutos >= 0;
      const pendenciasOperacionais = montarPendenciasOperacionaisPedido({
        pagamentoMeta,
        envelhecimentoMeta,
        requerAcao,
        proximoStatus,
        observacaoOperacional,
        possuiMuitosItens
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
        tipoEntregaNormalizado,
        observacaoOperacional,
        observacoesRelevantesLista,
        observacoesRelevantesCount,
        pendenciasOperacionais,
        resumoItensTexto: resumoItens.resumoTexto,
        totalItens: resumoItens.totalItens,
        totalItensDistintos,
        totalUnidadesEstimadas,
        possuiMuitosItens,
        pagamentoRequerConferencia,
        itensLista,
        enderecoDisponivel,
        enderecoTexto: enderecoTextoOperacional,
        tipoAtendimento: formatarTipoEntregaPedido(tipoEntregaNormalizado),
        whatsappLink: montarLinkWhatsappPedido(pedido),
        proximoStatus,
        acaoRapidaLabel: obterLabelAcaoRapida(statusNormalizado, tipoEntregaNormalizado),
        requerAcao,
        urgente,
        critico,
        metricasTempo: extrairMetricasTempoPedido(pedido),
        timelineEtapas: montarTimelineEtapas(pedido),
        indiceBusca: normalizarTextoBusca([
          pedido?.id,
          clienteNome,
          telefoneCliente,
          formaPagamento,
          statusNormalizado,
          tipoEntregaNormalizado,
          formatarTipoEntregaPedido(tipoEntregaNormalizado),
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
      pronto_para_retirada: 0,
      enviado: 0,
      retirado: 0,
      entregue: 0,
      cancelado: 0
    };

    let criticos = 0;
    let aguardandoAcao = 0;
    let emAndamento = 0;
    let concluidosHoje = 0;
    let pendentesPagamento = 0;

    // Métricas operacionais de tempo
    const preparoArr = [];
    const rotaArr = [];
    const totalArr = [];
    let prontosAguardandoSaida = 0;
    let emRotaAcimaSla = 0;
    let retiradasProntasAguardando = 0;

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

      if (['pago', 'preparando', 'pronto_para_retirada', 'enviado'].includes(pedido.statusNormalizado)) {
        emAndamento += 1;
      }

      if (['entregue', 'retirado'].includes(pedido.statusNormalizado) && pedido.dataMs > 0 && pedido.dataMs >= inicioHoje.getTime()) {
        concluidosHoje += 1;
      }

      if (['waiting', 'attention', 'error'].includes(pedido.pagamentoMeta.tone)) {
        pendentesPagamento += 1;
      }

      // Agregar métricas de tempo
      const mt = pedido.metricasTempo;
      if (mt) {
        if (mt.preparo?.ms != null) preparoArr.push(mt.preparo.ms);
        if (mt.rota?.ms != null) rotaArr.push(mt.rota.ms);
        if (mt.total?.ms != null) totalArr.push(mt.total.ms);
      }
      // Pedidos com preparo concluído aguardando saída do entregador
      if (pedido.tipoEntregaNormalizado === 'entrega'
        && ['pronto_para_retirada', 'preparando'].includes(pedido.statusNormalizado)
        && pedido.pronto_em) {
        prontosAguardandoSaida += 1;
      }
      // Retiradas prontas aguardando o cliente buscar
      if (pedido.statusNormalizado === 'pronto_para_retirada'
        && pedido.tipoEntregaNormalizado === 'retirada') {
        retiradasProntasAguardando += 1;
      }
      if (pedido.statusNormalizado === 'enviado' && mt?.rota?.sla === 'atrasado') {
        emRotaAcimaSla += 1;
      }
    });

    const media = (arr) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    return {
      total: pedidosOperacionais.length,
      criticos,
      aguardandoAcao,
      emAndamento,
      concluidosHoje,
      pendentesPagamento,
      contagemPorStatus,
      tempoMedioPreparo: media(preparoArr),
      tempoMedioRota: media(rotaArr),
      tempoMedioTotal: media(totalArr),
      prontosAguardandoSaida,
      emRotaAcimaSla,
      retiradasProntasAguardando
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

    if (filtroPedidoTipoEntrega !== 'todos') {
      const opcao = FILTRO_TIPO_ENTREGA_OPTIONS.find((item) => item.id === filtroPedidoTipoEntrega);
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
  }, [buscaPedidosOperacional, filtroPedidoPagamento, filtroPedidoStatus, filtroPedidoTipoEntrega, ordenacaoPedidos]);

  const pedidosFiltradosOperacionais = useMemo(() => {
    const termoBusca = normalizarTextoBusca(buscaPedidosOperacional);

    const filtrados = pedidosOperacionais.filter((pedido) => {
      if (filtroPedidoStatus === 'criticos' && !pedido.critico) {
        return false;
      }

      if (filtroPedidoStatus !== 'todos' && filtroPedidoStatus !== 'criticos' && pedido.statusNormalizado !== filtroPedidoStatus) {
        return false;
      }

      if (filtroPedidoTipoEntrega !== 'todos' && pedido.tipoEntregaNormalizado !== filtroPedidoTipoEntrega) {
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
    filtroPedidoTipoEntrega,
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
    const proximoStatus = obterProximoStatusPedido(statusAtual, pedido?.tipoEntregaNormalizado || pedido?.tipo_entrega);

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
    setFiltroPedidoTipoEntrega('todos');
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

  async function handleCopiarListaSeparacaoPedido(pedido) {
    await handleCopiarCampoPedido(
      montarListaSeparacaoPedido(pedido),
      `Lista de separação #${pedido?.id || ''}`
    );
  }

  async function handleCopiarMensagemContatoPedido(pedido) {
    await handleCopiarCampoPedido(
      montarMensagemContatoOperacionalPedido(pedido),
      `Mensagem de contato #${pedido?.id || ''}`
    );
  }

  async function handleCopiarConferenciaExpedicaoPedido(pedido) {
    await handleCopiarCampoPedido(
      montarResumoConferenciaExpedicaoPedido(pedido, { modoFilaAlta: modoFilaAltaAtivo }),
      `Conferência/expedição #${pedido?.id || ''}`
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
        emoji: produtoForm.emoji.trim() || '',
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
        <h1 style={{ color: '#E25C5C' }}>Acesso Restrito</h1>
        <p className="muted-text">O acesso administrativo está disponível apenas no computador da loja.</p>
      </section>
    );
  }

  if (adminAutenticado !== true) {
    return (
      <section className="page">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <ShieldCheck size={32} style={{ color: '#E2B84A' }} aria-hidden="true" />
          <h1 style={{ color: '#E2B84A', fontSize: '1.4rem', marginTop: '0.5rem' }}>BomFilho Admin</h1>
          <p className="muted-text">Informe suas credenciais para acessar o cockpit de gestão.</p>
        </div>

        {!needs2FA ? (
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
              {carregando ? 'Validando acesso...' : 'Entrar no cockpit'}
            </button>
          </form>
        ) : (
          <form className="form-box" onSubmit={handleVerify2FA}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
              <p style={{ color: '#4AE28A', fontSize: '0.85rem', fontWeight: 600 }}>{msg2FA}</p>
            </div>

            <label className="field-label" htmlFor="admin-2fa">Código de verificação</label>
            <input
              id="admin-2fa"
              className="field-input"
              style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.3em', fontFamily: 'Sora, sans-serif' }}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={codigo2FA}
              onChange={(event) => setCodigo2FA(event.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              required
            />

            {erro ? <p className="error-text">{erro}</p> : null}

            <button className="btn-primary" type="submit" disabled={carregando || codigo2FA.length !== 6}>
              {carregando ? 'Verificando...' : 'Verificar código'}
            </button>

            <button type="button" className="btn-secondary" onClick={() => { setNeeds2FA(false); setCodigo2FA(''); setErro(''); setMsg2FA(''); }} style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}>
              Voltar ao login
            </button>
          </form>
        )}
      </section>
    );
  }

  return (
    <AdminShell
      tab={tab}
      setTab={setTab}
      onLogout={handleAdminLogout}
      onRefresh={() => { void carregarTudo(); }}
      carregando={carregando}
    >
      {erro ? <p className="error-text" style={{ marginBottom: '0.5rem' }}>{erro}</p> : null}

      {tab === 'dashboard' ? (
        <CommandCenter onNavigate={setTab} />
      ) : tab === 'pedidos' ? (
        <OrdersScreen
          pedidos={pedidos}
          pedidosFiltradosOperacionais={pedidosFiltradosOperacionais}
          pedidoExpandidoId={pedidoExpandidoId}
          setPedidoExpandidoId={setPedidoExpandidoId}
          paginacaoPedidos={paginacaoPedidos}
          carregandoPedidos={carregandoPedidos}
          carregarPedidosPagina={(p) => { void carregarPedidosPagina(p); }}
          filtroPedidoStatus={filtroPedidoStatus}
          setFiltroPedidoStatus={setFiltroPedidoStatus}
          filtroPedidoPagamento={filtroPedidoPagamento}
          setFiltroPedidoPagamento={setFiltroPedidoPagamento}
          filtroPedidoTipoEntrega={filtroPedidoTipoEntrega}
          setFiltroPedidoTipoEntrega={setFiltroPedidoTipoEntrega}
          ordenacaoPedidos={ordenacaoPedidos}
          setOrdenacaoPedidos={setOrdenacaoPedidos}
          buscaPedidosOperacional={buscaPedidosOperacional}
          setBuscaPedidosOperacional={setBuscaPedidosOperacional}
          autoRefreshPedidosAtivo={autoRefreshPedidosAtivo}
          setAutoRefreshPedidosAtivo={setAutoRefreshPedidosAtivo}
          modoFilaAltaAtivo={modoFilaAltaAtivo}
          handleToggleModoFilaAlta={handleToggleModoFilaAlta}
          statusDraft={statusDraft}
          setStatusDraft={setStatusDraft}
          feedbackPedidos={feedbackPedidos}
          resumoPedidosOperacionais={resumoPedidosOperacionais}
          contadorPedidosOperacionaisTexto={contadorPedidosOperacionaisTexto}
          statusChipsOperacionais={statusChipsOperacionais}
          filtrosPedidosAplicados={filtrosPedidosAplicados}
          atualizandoStatusPedidoId={atualizandoStatusPedidoId}
          avisoNovosPedidos={novosPedidosDetectados}
          limparAvisoNovosPedidos={limparAvisoNovosPedidos}
          resumoAuditoriaSessao={resumoAuditoriaSessao}
          historicoAcoesSessao={historicoAcoesSessao}
          limparHistoricoAuditoriaSessao={limparHistoricoAuditoriaSessao}
          handleAcaoRapidaPedido={handleAcaoRapidaPedido}
          handleCopiarResumoPedido={handleCopiarResumoPedido}
          handleCopiarListaSeparacaoPedido={handleCopiarListaSeparacaoPedido}
          handleCopiarConferenciaExpedicaoPedido={handleCopiarConferenciaExpedicaoPedido}
          handleCopiarMensagemContatoPedido={handleCopiarMensagemContatoPedido}
          handleCopiarCampoPedido={handleCopiarCampoPedido}
          abrirPrimeiroPedidoPrioritario={abrirPrimeiroPedidoPrioritario}
          limparFiltrosPedidosOperacionais={limparFiltrosPedidosOperacionais}
          formatarStatusPedido={formatarStatusPedido}
          formatarMoeda={formatarMoeda}
          formatarTempoRelativo={formatarTempoRelativo}
          PEDIDOS_TAB_SOMENTE_HISTORICO={PEDIDOS_TAB_SOMENTE_HISTORICO}
          STATUS_OPTIONS={STATUS_OPTIONS}
        />
      ) : tab === 'produtos' ? (
        <CatalogScreen
          produtoForm={produtoForm}
          setProdutoForm={setProdutoForm}
          buscandoCodigo={buscandoCodigo}
          handleBuscarProdutoPorCodigoBarras={handleBuscarProdutoPorCodigoBarras}
          salvandoProduto={salvandoProduto}
          handleCadastrarProduto={handleCadastrarProduto}
          produtos={produtos}
          handleExcluirProduto={handleExcluirProduto}
          paginacaoProdutos={paginacaoProdutos}
          carregandoProdutos={carregandoProdutos}
          carregarProdutosPagina={carregarProdutosPagina}
          SmartImage={SmartImage}
        />
      ) : tab === 'financeiro' ? (
        <FinanceScreen
          financeiro={financeiro}
          resumoFinanceiroFiltrado={resumoFinanceiroFiltrado}
          linhasFinanceiro={linhasFinanceiro}
          filtroFinanceiroPeriodo={filtroFinanceiroPeriodo}
          setFiltroFinanceiroPeriodo={setFiltroFinanceiroPeriodo}
          filtroFinanceiroStatus={filtroFinanceiroStatus}
          setFiltroFinanceiroStatus={setFiltroFinanceiroStatus}
          filtroFinanceiroOrdem={filtroFinanceiroOrdem}
          setFiltroFinanceiroOrdem={setFiltroFinanceiroOrdem}
          filtroFinanceiroBusca={filtroFinanceiroBusca}
          setFiltroFinanceiroBusca={setFiltroFinanceiroBusca}
          filtroFinanceiroInicio={filtroFinanceiroInicio}
          setFiltroFinanceiroInicio={setFiltroFinanceiroInicio}
          filtroFinanceiroFim={filtroFinanceiroFim}
          setFiltroFinanceiroFim={setFiltroFinanceiroFim}
          paginacaoPedidos={paginacaoPedidos}
          carregandoPedidos={carregandoPedidos}
          carregarPedidosPagina={(p) => { void carregarPedidosPagina(p); }}
          exportarFinanceiroCsv={exportarFinanceiroCsv}
          statusOptions={STATUS_OPTIONS}
          formatarStatusPedido={formatarStatusPedido}
          formasPagamentoLabels={FORMAS_PAGAMENTO_LABELS}
        />
      ) : tab === 'importacao' ? (
        <ImportScreen
          modeloImportacaoUrl={modeloImportacaoUrl}
          arquivoImportacao={arquivoImportacao}
          arrastandoImportacao={arrastandoImportacao}
          importarCriarNovos={importarCriarNovos}
          setImportarCriarNovos={setImportarCriarNovos}
          importandoPlanilha={importandoPlanilha}
          resultadoImportacao={resultadoImportacao}
          historicoImportacoes={historicoImportacoes}
          carregandoImportacoes={carregandoImportacoes}
          handleArquivoImportacaoChange={handleArquivoImportacaoChange}
          handleDragOverImportacao={handleDragOverImportacao}
          handleDragLeaveImportacao={handleDragLeaveImportacao}
          handleDropImportacao={handleDropImportacao}
          handleImportarPlanilha={handleImportarPlanilha}
          handleSimularPlanilha={handleSimularPlanilha}
          carregarHistoricoImportacoes={carregarHistoricoImportacoes}
          formatarStatusImportacao={formatarStatusImportacao}
          formatarTamanhoArquivo={formatarTamanhoArquivo}
        />
      ) : tab === 'operacao' ? (
        <FilaOperacional />
      ) : tab === 'clientes' ? (
        <ClientesAdmin />
      ) : tab === 'fin-avancado' ? (
        <FinanceiroAvancado />
      ) : tab === 'auditoria' ? (
        <AuditoriaAdmin />
      ) : tab === 'relatorios' ? (
        <RelatoriosAdmin />
      ) : tab === 'catalogo' ? (
        <CatalogoSaude />
      ) : null}
    </AdminShell>
  );
}
