/**
 * Utilitários puros do checkout — extraídos de PagamentoPage para reuso e testabilidade.
 * Nenhuma dependência de React.
 */

import { STORE_CEP, STORE_LIMITE_BIKE_KM, STORE_NUMERO, RETIRADA_LOJA_INFO } from '../config/store';

// ── Constantes do checkout ──────────────────────────────────────────────

export const ETAPAS = Object.freeze({
  CARRINHO: 'carrinho',
  ENTREGA: 'entrega',
  PAGAMENTO: 'pagamento',
  REVISAO: 'revisao',
  PIX: 'pix',
  STATUS: 'status'
});

export const CHECKOUT_STEPS = ['Carrinho', 'Entrega', 'Pagamento', 'Revisão', 'Confirmação'];

export const PARCELAMENTO_MINIMO_CREDITO = 100;
export const PARCELAMENTO_MAXIMO_CREDITO = 3;
export const TAXA_SERVICO_PERCENTUAL = 3;
export const SESSAO_3DS_TTL_MS = 29 * 60 * 1000;
export const HOMOLOGACAO_3DS_MAX_EVENTOS = 40;

export const CEP_MERCADO = STORE_CEP;
export const NUMERO_MERCADO = STORE_NUMERO;
export const LIMITE_BIKE_KM = STORE_LIMITE_BIKE_KM;
export { RETIRADA_LOJA_INFO };

export const STATUS_3DS_LABELS = Object.freeze({
  idle: 'Autenticacao 3DS ainda nao iniciada.',
  iniciando: 'Iniciando autenticacao 3DS...',
  aguardando_validacao: 'Aguardando validacao de seguranca...',
  desafio: 'Desafio 3DS em andamento. Siga as instrucoes do emissor.',
  concluida: 'Autenticacao 3DS concluida com sucesso.',
  processando_pagamento: 'Autenticacao concluida. Processando pagamento...',
  pagamento_aprovado: 'Pagamento aprovado.',
  nao_suportado: 'Cartao nao elegivel para 3DS no debito.',
  trocar_metodo: 'Autenticacao negada. Escolha outro meio de pagamento.',
  erro: 'Falhou na autenticacao 3DS.'
});

export const VEICULOS_ENTREGA = Object.freeze({
  bike: {
    label: 'Bike',
    imagem: '/img/veiculos/bike.svg',
    icone: 'bike',
    descricao: 'Mais econômica para distâncias curtas',
    vantagem: 'Ideal para entregas rápidas no entorno da loja',
    consumo: 'Sem combustível',
    fatorReparo: 1.1,
    observacao: `Até ${LIMITE_BIKE_KM.toFixed(1)} km do mercado`
  },
  moto: {
    label: 'Moto',
    imagem: '/img/veiculos/moto.svg',
    icone: 'motorbike',
    descricao: 'Melhor equilíbrio entre velocidade e custo',
    vantagem: 'Opção mais indicada para a maioria dos pedidos',
    consumo: '30 km/l',
    fatorReparo: 1.5,
    observacao: 'Equilíbrio entre velocidade e custo'
  },
  carro: {
    label: 'Carro',
    imagem: '/img/veiculos/carro.svg',
    icone: 'car',
    descricao: 'Ideal para pedidos maiores e volumosos',
    vantagem: 'Mais capacidade para compras completas',
    consumo: '12 km/l',
    fatorReparo: 2.2,
    observacao: 'Ideal para pedidos maiores'
  }
});

export const FORMAS_PAGAMENTO_OPCOES = Object.freeze({
  pix: {
    icon: 'pix',
    title: 'PIX',
    headline: 'Pagamento instantâneo com confirmação automática',
    details: ['QR Code e código Copia e Cola', 'Confirmação automática após pagamento'],
    summaryTitle: 'Pagamento via PIX',
    summaryDescription: [
      'Gere o QR Code na próxima etapa e pague na hora.',
      'A confirmação acontece automaticamente após aprovação.'
    ],
    ctaText: 'Gerar PIX e continuar'
  },
  credito: {
    icon: 'credit-card',
    title: 'Cartão de crédito',
    headline: 'Pagamento protegido com opção de parcelamento',
    details: [
      'Parcelamento em até 3x',
      `Disponível para pedidos acima de R$ ${PARCELAMENTO_MINIMO_CREDITO.toFixed(2).replace('.', ',')}`
    ],
    summaryTitle: 'Pagamento com cartão de crédito',
    summaryDescription: [
      'Preencha os dados do cartão para concluir com segurança.',
      'Você pode escolher as parcelas disponíveis para este pedido.'
    ],
    ctaText: 'Continuar para confirmação'
  },
  debito: {
    icon: 'debit-card',
    title: 'Cartão de débito',
    headline: 'Pagamento à vista com aprovação da operadora',
    details: ['Pagamento à vista', 'Confirmação após aprovação da operadora'],
    summaryTitle: 'Pagamento com cartão de débito',
    summaryDescription: [
      'Finalize o pedido com pagamento à vista no cartão.',
      'A confirmação ocorre após a autorização da operadora.'
    ],
    ctaText: 'Continuar para confirmação'
  }
});

export const PIX_QR_RENDER_OPTIONS = Object.freeze({
  width: 360,
  margin: 1,
  errorCorrectionLevel: 'M'
});

// ── Status labels ───────────────────────────────────────────────────────

export const STATUS_PEDIDO_LABELS = Object.freeze({
  aguardando_revisao: 'Em revisão',
  pendente: 'Aguardando confirmação',
  pagamento_recusado: 'Pagamento recusado',
  preparando: 'Em preparação',
  enviado: 'Saiu para entrega',
  pronto_para_retirada: 'Pronto para retirada',
  retirado: 'Retirado na loja',
  entregue: 'Entregue',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
  pago: 'Pago'
});

export const STATUS_PAGAMENTO_LABELS = Object.freeze({
  WAITING: 'Aguardando pagamento',
  PENDING: 'Aguardando pagamento',
  IN_ANALYSIS: 'Em análise',
  IN_PROCESS: 'Em análise',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pagamento aprovado',
  APPROVED: 'Pagamento aprovado',
  DECLINED: 'Pagamento recusado',
  REJECTED: 'Pagamento recusado',
  CANCELED: 'Pagamento cancelado',
  EXPIRED: 'Pagamento expirado'
});

export const PIX_STATUS_META = Object.freeze({
  WAITING: { tone: 'warning', icon: 'pending', guidance: 'Aguardando confirmação do banco. Assim que for aprovado, a etapa de confirmação será liberada.' },
  PENDING: { tone: 'warning', icon: 'pending', guidance: 'Aguardando confirmação do banco. Assim que for aprovado, a etapa de confirmação será liberada.' },
  IN_ANALYSIS: { tone: 'info', icon: 'analysis', guidance: 'Seu pagamento está em análise. Isso pode levar alguns instantes.' },
  IN_PROCESS: { tone: 'info', icon: 'analysis', guidance: 'Seu pagamento está em análise. Isso pode levar alguns instantes.' },
  AUTHORIZED: { tone: 'info', icon: 'authorized', guidance: 'Pagamento autorizado. A confirmação final será atualizada automaticamente.' },
  PAID: { tone: 'success', icon: 'paid', guidance: 'Pagamento confirmado com sucesso. Você já pode seguir para a confirmação do pedido.' },
  APPROVED: { tone: 'success', icon: 'paid', guidance: 'Pagamento confirmado com sucesso. Você já pode seguir para a confirmação do pedido.' },
  EXPIRED: { tone: 'danger', icon: 'expired', guidance: 'Este PIX expirou. Gere um novo QR Code para tentar novamente.' },
  CANCELED: { tone: 'danger', icon: 'canceled', guidance: 'Pagamento cancelado. Gere um novo PIX para concluir o pedido.' },
  DECLINED: { tone: 'danger', icon: 'declined', guidance: 'Pagamento não aprovado. Gere um novo PIX e tente novamente.' },
  REJECTED: { tone: 'danger', icon: 'declined', guidance: 'Pagamento não aprovado. Gere um novo PIX e tente novamente.' }
});

// ── QR Code lazy‑load ───────────────────────────────────────────────────

let qrcodeModulePromise = null;

export async function gerarQrCodeDataUrl(codigoPix) {
  if (!qrcodeModulePromise) {
    qrcodeModulePromise = import('qrcode').catch((err) => {
      qrcodeModulePromise = null;
      throw err;
    });
  }
  const moduloQrCode = await qrcodeModulePromise;
  const QRCodeLib = moduloQrCode?.default || moduloQrCode;
  return QRCodeLib.toDataURL(codigoPix, PIX_QR_RENDER_OPTIONS);
}

// ── Formatação ──────────────────────────────────────────────────────────

export function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarQuantidadeItens(valor) {
  const quantidade = Number(valor || 0);
  if (!Number.isFinite(quantidade) || quantidade <= 0) return '0 itens';
  return `${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`;
}

export function formatarTipoEntrega(tipoEntrega) {
  return String(tipoEntrega || '').trim().toLowerCase() === 'retirada' ? 'Retirada na loja' : 'Entrega';
}

export function formatarStatusPedido(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_PEDIDO_LABELS[status] || 'Em análise';
}

export function formatarStatusPagamento(statusRaw) {
  const status = String(statusRaw || '').trim().toUpperCase();
  return STATUS_PAGAMENTO_LABELS[status] || 'Em processamento';
}

// ── CEP / Endereço ──────────────────────────────────────────────────────

export function normalizarCep(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

export function formatarCep(valor) {
  const cep = normalizarCep(valor);
  if (cep.length <= 5) return cep;
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

export function erroEntregaEhCobertura(mensagem) {
  const texto = String(mensagem || '').toLowerCase();
  return (
    texto.includes('cobertura')
    || texto.includes('fora da area')
    || texto.includes('fora da área')
    || texto.includes('não atend')
    || texto.includes('nao atend')
  );
}

function normalizarTextoEntrega(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function itemEhRestritoMoto(item = {}) {
  if (item?.restrito_moto === true || item?.restritoMoto === true) {
    return true;
  }

  const texto = `${normalizarTextoEntrega(item?.nome)} ${normalizarTextoEntrega(item?.categoria)}`;
  const palavras = ['agua 20', 'galao', 'gas', 'botijao'];
  return palavras.some((palavra) => texto.includes(palavra));
}

export function estimarPesoCarrinhoKg(carrinho = []) {
  if (!Array.isArray(carrinho) || carrinho.length === 0) {
    return 0;
  }

  const basePorItem = (item) => {
    const explicito = Number(item?.peso_kg || item?.pesoKg || item?.peso || 0);
    if (Number.isFinite(explicito) && explicito > 0) {
      return explicito;
    }

    const texto = `${normalizarTextoEntrega(item?.nome)} ${normalizarTextoEntrega(item?.categoria)}`;
    if (texto.includes('fardo') || texto.includes('caixa') || texto.includes('saco')) return 4;
    if (texto.includes('refrigerante') || texto.includes('bebida') || texto.includes('leite') || texto.includes('arroz')) return 1.3;
    if (itemEhRestritoMoto(item)) return 12;
    return 0.45;
  };

  const peso = carrinho.reduce((acc, item) => {
    const quantidade = Math.max(1, Number(item?.quantidade || 1));
    return acc + (basePorItem(item) * quantidade);
  }, 0);

  return Math.round(peso * 100) / 100;
}

export function resolverModalEntregaUber(carrinho = [], distanciaKm = 0, pesoEstimadoKg = null, quantidadeItens = null) {
  const lista = Array.isArray(carrinho) ? carrinho : [];
  const qtdItens = Number.isFinite(Number(quantidadeItens))
    ? Number(quantidadeItens)
    : lista.reduce((acc, item) => acc + Math.max(1, Number(item?.quantidade || 1)), 0);
  const peso = Number.isFinite(Number(pesoEstimadoKg)) ? Number(pesoEstimadoKg) : estimarPesoCarrinhoKg(lista);
  const distancia = Number(distanciaKm || 0);

  const possuiRestritoMoto = lista.some((item) => itemEhRestritoMoto(item));
  const pedidoMuitoGrande = qtdItens >= 18 || peso >= 20;
  const pedidoMedio = qtdItens >= 10 || peso >= 10;

  if (possuiRestritoMoto || pedidoMuitoGrande) {
    return 'carro';
  }

  if (distancia > 0 && distancia <= LIMITE_BIKE_KM && !pedidoMedio) {
    return 'bike';
  }

  if (pedidoMedio) {
    return 'carro';
  }

  return 'moto';
}

// ── CPF / CNPJ ──────────────────────────────────────────────────────────

export function normalizarDocumentoFiscal(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

export function possuiDigitosRepetidos(valor) {
  return /(\d)\1{10,13}/.test(String(valor || ''));
}

export function validarCpf(cpf) {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (digits.length !== 11 || possuiDigitosRepetidos(digits)) return false;

  const calcularDigito = (base, fatorInicial) => {
    let soma = 0;
    for (let i = 0; i < base.length; i += 1) {
      soma += Number(base[i]) * (fatorInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const base = digits.slice(0, 9);
  const digito1 = calcularDigito(base, 10);
  const digito2 = calcularDigito(`${base}${digito1}`, 11);
  return Number(digits[9]) === digito1 && Number(digits[10]) === digito2;
}

export function validarCnpj(cnpj) {
  const digits = String(cnpj || '').replace(/\D/g, '');
  if (digits.length !== 14 || possuiDigitosRepetidos(digits)) return false;

  const calcularDigito = (base, pesos) => {
    const soma = base.split('').reduce((acc, d, i) => acc + (Number(d) * pesos[i]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base = digits.slice(0, 12);
  const digito1 = calcularDigito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digito2 = calcularDigito(`${base}${digito1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return Number(digits[12]) === digito1 && Number(digits[13]) === digito2;
}

export function validarDocumentoFiscal3DS(valor) {
  const digits = normalizarDocumentoFiscal(valor);
  if (digits.length === 11) return validarCpf(digits);
  if (digits.length === 14) return validarCnpj(digits);
  return false;
}

export function formatarDocumentoFiscal(valor) {
  const digits = normalizarDocumentoFiscal(valor);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

// ── Cartão ──────────────────────────────────────────────────────────────

export function normalizarNumeroCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 19);
}

export function formatarNumeroCartao(valor) {
  return normalizarNumeroCartao(valor).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function formatarMesCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 2);
}

export function formatarAnoCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 4);
}

export function normalizarAnoCartaoParaComparacao(valor) {
  const digits = formatarAnoCartao(valor);
  if (digits.length === 4) {
    return digits;
  }

  if (digits.length !== 2) {
    return '';
  }

  // Converte AA -> 20AA para tokenizacao de cartao.
  return `20${digits}`;
}

export function normalizarAnoCartaoParaTokenizacao(valor) {
  const digits = formatarAnoCartao(valor);
  if (digits.length === 2) {
    return digits;
  }

  if (digits.length === 4) {
    return digits.slice(2);
  }

  return '';
}

export function formatarCvvCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 4);
}

// ── 3DS helpers ─────────────────────────────────────────────────────────

export function normalizarNomeCompletoPara3DS(valor, fallback = 'Cliente Teste') {
  const base = String(valor || '').trim();
  const semCaracteresInvalidos = base
    .replace(/[^\p{L}\s'.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!semCaracteresInvalidos) return fallback;
  const partes = semCaracteresInvalidos.split(' ').filter(Boolean);
  if (partes.length >= 2) return partes.join(' ');
  return `${partes[0]} Teste`;
}

export function normalizarTelefonePara3DS(telefone) {
  const digits = String(telefone || '').replace(/\D/g, '');
  if (!digits) return null;
  const semPais = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (semPais.length < 10) return null;
  const area = semPais.slice(0, 2);
  const number = semPais.slice(2);
  if (!area || !number) return null;
  return { country: '55', area, number, type: 'MOBILE' };
}

export function normalizarNumeroEnderecoPara3DS(numero) {
  const digits = String(numero || '').replace(/\D/g, '').trim();
  const numeroInteiro = Number.parseInt(digits, 10);
  if (Number.isInteger(numeroInteiro) && numeroInteiro > 0) return String(numeroInteiro);
  return '1';
}

export function construirEndereco3DS({ endereco, cepFallback } = {}) {
  const cepDigits = normalizarCep(endereco?.cep || cepFallback || '');
  const addr = {
    street: String(endereco?.logradouro || 'Endereco').trim() || 'Endereco',
    number: normalizarNumeroEnderecoPara3DS(endereco?.numero),
    regionCode: String(endereco?.estado || 'SP').trim().toUpperCase().slice(0, 2) || 'SP',
    country: 'BRA',
    city: String(endereco?.cidade || 'Sao Paulo').trim() || 'Sao Paulo',
    postalCode: cepDigits || '01001000'
  };
  const complemento = String(endereco?.complemento || '').trim();
  if (complemento) addr.complement = complemento;
  return addr;
}

// ── Homologação / mascarar logs ─────────────────────────────────────────

export function mascararValorHomologacao(valor, { prefixo = 6, sufixo = 4 } = {}) {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  if (texto.length <= prefixo + sufixo) return `${texto.slice(0, 2)}***`;
  return `${texto.slice(0, prefixo)}***${texto.slice(-sufixo)}`;
}

export function mascararDocumentoHomologacao(valor) {
  const digits = normalizarDocumentoFiscal(valor);
  if (!digits) return '';
  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

export function mascararTraceHomologacao(valor) {
  return mascararValorHomologacao(valor, { prefixo: 8, sufixo: 4 });
}

export function sanitizarErrorMessages3DS(errorMessages) {
  if (!Array.isArray(errorMessages) || !errorMessages.length) return [];
  return errorMessages.slice(0, 8).map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const field = String(item.field || item.parameter_name || item.parameterName || item.parameter || item.property || item.path || item.pointer || item.target || item.name || '').trim() || null;
      const code = String(item.code || item.error || item.reason || '').trim() || null;
      const message = String(item.message || item.description || item.detail || '').trim() || null;
      return { field, code, message };
    }
    return { field: null, code: null, message: String(item || '').trim() || null };
  });
}

export function sanitizarRequestPagamentoCartaoHomologacao({ payloadRequest, endpoint = '/api/pagamentos/cartao' } = {}) {
  const payload = (payloadRequest && typeof payloadRequest === 'object' && !Array.isArray(payloadRequest)) ? payloadRequest : {};
  return {
    endpoint,
    pedido_id: Number.parseInt(String(payload?.pedido_id || ''), 10) || null,
    reference_id: payload?.pedido_id ? `pedido_${payload.pedido_id}` : null,
    tipo_cartao: String(payload?.tipo_cartao || '').trim().toLowerCase() || null,
    parcelas: Number.parseInt(String(payload?.parcelas || ''), 10) || 1,
    tax_id_masked: mascararDocumentoHomologacao(payload?.tax_id),
    token_cartao_masked: mascararValorHomologacao(payload?.token_cartao, { prefixo: 10, sufixo: 6 }),
    authentication_method: payload?.authentication_method
      ? { type: String(payload.authentication_method?.type || '').trim().toUpperCase() || null, id_masked: mascararValorHomologacao(payload.authentication_method?.id, { prefixo: 6, sufixo: 4 }) || null }
      : null,
    three_ds_result: payload?.three_ds_result
      ? { flow: String(payload.three_ds_result?.flow || '').trim() || null, status: String(payload.three_ds_result?.status || '').trim().toUpperCase() || null, id_masked: mascararValorHomologacao(payload.three_ds_result?.id, { prefixo: 6, sufixo: 4 }) || null, trace_id_masked: mascararTraceHomologacao(payload.three_ds_result?.trace_id || payload.three_ds_result?.traceId) || null }
      : null,
    recaptcha_token_present: Boolean(String(payload?.recaptcha_token || '').trim())
  };
}

export function extrairStatusThreeDSChargeHomologacao(responsePayload) {
  const payload = (responsePayload && typeof responsePayload === 'object' && !Array.isArray(responsePayload)) ? responsePayload : {};
  const raw = (payload?.raw && typeof payload.raw === 'object' && !Array.isArray(payload.raw)) ? payload.raw : null;
  const charge = Array.isArray(raw?.charges) ? raw.charges[0] || null : null;
  const candidatos = [
    payload?.status_charge_threeds,
    charge?.threeds?.status,
    charge?.three_ds?.status,
    charge?.authentication_method?.status,
    charge?.payment_method?.authentication_method?.status,
    charge?.payment_method?.card?.threeds?.status,
    charge?.payment_method?.card?.three_ds?.status
  ];
  for (const c of candidatos) {
    const v = String(c || '').trim().toUpperCase();
    if (v) return v;
  }
  return null;
}

export function montarResumoRespostaGatewayHomologacao({ responsePayload, pedidoId } = {}) {
  const payload = (responsePayload && typeof responsePayload === 'object' && !Array.isArray(responsePayload)) ? responsePayload : {};
  const raw = (payload?.raw && typeof payload.raw === 'object' && !Array.isArray(payload.raw)) ? payload.raw : null;
  const charge = Array.isArray(raw?.charges) ? raw.charges[0] || null : null;
  const pr = (payload?.payment_response && typeof payload.payment_response === 'object') ? payload.payment_response : {};
  const prRaw = charge?.payment_response || {};
  const chargesStatus = String(payload?.status_charge || charge?.status || payload?.status || '').trim().toUpperCase() || null;
  const threeDSStatus = extrairStatusThreeDSChargeHomologacao(payload);
  const prCode = String(pr?.code || prRaw?.code || payload?.authorization_code || '').trim() || null;
  const prMsg = String(pr?.message || prRaw?.message || payload?.message || '').trim() || null;
  const authId = String(payload?.authentication_id_3ds || '').trim();
  const traceId = String(payload?.trace_id || '').trim();
  const refId = String(payload?.reference_id || raw?.reference_id || (pedidoId ? `pedido_${pedidoId}` : '')).trim();

  return {
    endpoint: '/api/pagamentos/cartao',
    pedido_id: Number.parseInt(String(pedidoId || payload?.pedido_id || ''), 10) || null,
    reference_id: refId || null,
    gateway_order_id: String(payload?.gateway_order_id || raw?.id || '').trim() || null,
    charges: { status: chargesStatus, threeds: { status: threeDSStatus } },
    payment_response: { code: prCode, message: prMsg },
    three_ds_validation: {
      status: String(payload?.three_ds_status || '').trim().toUpperCase() || null,
      codigo: String(payload?.three_ds_codigo || '').trim().toUpperCase() || null,
      authentication_id_masked: authId ? mascararValorHomologacao(authId, { prefixo: 6, sufixo: 4 }) : null
    },
    trace_id_masked: traceId ? mascararTraceHomologacao(traceId) : null,
    response_final_gateway_masked: raw
      ? {
        id: String(raw?.id || '').trim() || null,
        reference_id: String(raw?.reference_id || '').trim() || null,
        status: String(raw?.status || '').trim().toUpperCase() || null,
        charges: charge ? [{ id: String(charge?.id || '').trim() || null, reference_id: String(charge?.reference_id || '').trim() || null, status: String(charge?.status || '').trim().toUpperCase() || null, threeds: { status: threeDSStatus }, payment_response: { code: prCode, message: prMsg } }] : []
      }
      : null
  };
}

// ── PIX status helpers ──────────────────────────────────────────────────

export function resolverStatusPix({ status, statusInterno, pagamentoConfirmado }) {
  const s = String(status || '').trim().toUpperCase();
  if (s) return s;
  const si = String(statusInterno || '').trim().toLowerCase();
  if (pagamentoConfirmado || si === 'pago' || si === 'entregue') return 'PAID';
  if (si === 'cancelado') return 'CANCELED';
  if (si === 'pagamento_recusado') return 'DECLINED';
  return 'WAITING';
}

export function obterStatusPixVisual({ status, statusInterno, pagamentoConfirmado }) {
  const code = resolverStatusPix({ status, statusInterno, pagamentoConfirmado });
  const meta = PIX_STATUS_META[code] || { tone: 'neutral', icon: 'pending', guidance: 'Atualize o status para confirmar a situação do pagamento.' };
  return {
    code,
    tone: meta.tone,
    icon: meta.icon,
    label: formatarStatusPagamento(code),
    guidance: meta.guidance,
    aprovado: code === 'PAID'
  };
}
