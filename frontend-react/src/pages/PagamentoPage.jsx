import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import {
  buscarEnderecoViaCep,
  criarPedido,
  criarSessao3DSPagBank,
  gerarPix,
  getMe,
  getPagBankPublicKey,
  getPedidos,
  isAuthErrorMessage,
  pagarCartao,
  simularFretePorCep
} from '../lib/api';
import {
  autenticar3DSPagBank,
  configurarSessao3DSPagBank,
  criptografarCartaoPagBank
} from '../lib/pagbank';
import {
  CHECKOUT_RECAPTCHA_ENABLED,
  IS_DEVELOPMENT,
  RECAPTCHA_SITE_KEY
} from '../config/api';
import {
  buildCartEventPayload,
  buildOrderItemsPayload,
  captureCommerceEvent
} from '../lib/commerceTracking';
import {
  GROWTH_UPDATE_EVENT_NAME,
  getGrowthInsights
} from '../lib/conversionGrowth';
import { useCart } from '../context/CartContext';
import SmartImage from '../components/ui/SmartImage';

const ETAPAS = {
  CARRINHO: 'carrinho',
  ENTREGA: 'entrega',
  PAGAMENTO: 'pagamento',
  PIX: 'pix',
  STATUS: 'status'
};

const CHECKOUT_STEPS = ['Carrinho', 'Entrega', 'Pagamento', 'Confirmação'];

const PARCELAMENTO_MINIMO_CREDITO = 100;
const PARCELAMENTO_MAXIMO_CREDITO = 3;
const SESSAO_3DS_TTL_MS = 29 * 60 * 1000;
const HOMOLOGACAO_3DS_MAX_EVENTOS = 40;

const STATUS_3DS_LABELS = {
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
};

const CEP_MERCADO = '68740-180';
const NUMERO_MERCADO = '70';
const LIMITE_BIKE_KM = 1;
const RETIRADA_LOJA_INFO = Object.freeze({
  nome: 'BomFilho Supermercado',
  endereco: `Travessa 07 de Setembro, nº ${NUMERO_MERCADO} - CEP ${CEP_MERCADO}`,
  horario: 'Segunda a sábado, das 07h às 22h',
  tempo_estimado: '20-40 min'
});

const VEICULOS_ENTREGA = {
  bike: {
    label: 'Bike',
    imagem: '/img/veiculos/bike.svg',
    icone: '🚲',
    descricao: 'Mais econômica para distâncias curtas',
    vantagem: 'Ideal para entregas rápidas no entorno da loja',
    consumo: 'Sem combustível',
    fatorReparo: 1.1,
    observacao: `Até ${LIMITE_BIKE_KM.toFixed(1)} km do mercado`
  },
  moto: {
    label: 'Moto',
    imagem: '/img/veiculos/moto.svg',
    icone: '🏍️',
    descricao: 'Melhor equilíbrio entre velocidade e custo',
    vantagem: 'Opção mais indicada para a maioria dos pedidos',
    consumo: '30 km/l',
    fatorReparo: 1.5,
    observacao: 'Equilíbrio entre velocidade e custo'
  },
  carro: {
    label: 'Carro',
    imagem: '/img/veiculos/carro.svg',
    icone: '🚗',
    descricao: 'Ideal para pedidos maiores e volumosos',
    vantagem: 'Mais capacidade para compras completas',
    consumo: '12 km/l',
    fatorReparo: 2.2,
    observacao: 'Ideal para pedidos maiores'
  }
};

const FORMAS_PAGAMENTO_OPCOES = {
  pix: {
    icon: '💠',
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
    icon: '💳',
    title: 'Cartão de crédito',
    headline: 'Pagamento protegido com opção de parcelamento',
    details: ['Parcelamento em até 3x', `Disponível para pedidos acima de R$ ${PARCELAMENTO_MINIMO_CREDITO.toFixed(2).replace('.', ',')}`],
    summaryTitle: 'Pagamento com cartão de crédito',
    summaryDescription: [
      'Preencha os dados do cartão para concluir com segurança.',
      'Você pode escolher as parcelas disponíveis para este pedido.'
    ],
    ctaText: 'Continuar para confirmação'
  },
  debito: {
    icon: '🏧',
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
};

const PIX_QR_RENDER_OPTIONS = Object.freeze({
  width: 360,
  margin: 1,
  errorCorrectionLevel: 'M'
});

let qrcodeModulePromise = null;

async function gerarQrCodeDataUrl(codigoPix) {
  if (!qrcodeModulePromise) {
    qrcodeModulePromise = import('qrcode');
  }

  const moduloQrCode = await qrcodeModulePromise;
  const QRCodeLib = moduloQrCode?.default || moduloQrCode;
  return QRCodeLib.toDataURL(codigoPix, PIX_QR_RENDER_OPTIONS);
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarQuantidadeItens(valor) {
  const quantidade = Number(valor || 0);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return '0 itens';
  }

  return `${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`;
}

function formatarTipoEntrega(tipoEntrega) {
  return String(tipoEntrega || '').trim().toLowerCase() === 'retirada'
    ? 'Retirada na loja'
    : 'Entrega';
}

function erroEntregaEhCobertura(mensagem) {
  const texto = String(mensagem || '').toLowerCase();
  return (
    texto.includes('cobertura')
    || texto.includes('fora da area')
    || texto.includes('fora da área')
    || texto.includes('não atend')
    || texto.includes('nao atend')
  );
}

function normalizarCep(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 8);
}

function formatarCep(valor) {
  const cep = normalizarCep(valor);
  if (cep.length <= 5) {
    return cep;
  }

  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function normalizarDocumentoFiscal(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 14);
}

function possuiDigitosRepetidos(valor) {
  return /(\d)\1{10,13}/.test(String(valor || ''));
}

function validarCpf(cpf) {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (digits.length !== 11 || possuiDigitosRepetidos(digits)) {
    return false;
  }

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

function validarCnpj(cnpj) {
  const digits = String(cnpj || '').replace(/\D/g, '');
  if (digits.length !== 14 || possuiDigitosRepetidos(digits)) {
    return false;
  }

  const calcularDigito = (base, pesos) => {
    const soma = base
      .split('')
      .reduce((acumulador, digito, index) => acumulador + (Number(digito) * pesos[index]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base = digits.slice(0, 12);
  const digito1 = calcularDigito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digito2 = calcularDigito(`${base}${digito1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return Number(digits[12]) === digito1 && Number(digits[13]) === digito2;
}

function validarDocumentoFiscalPagBank3DS(valor) {
  const digits = normalizarDocumentoFiscal(valor);
  if (digits.length === 11) {
    return validarCpf(digits);
  }

  if (digits.length === 14) {
    return validarCnpj(digits);
  }

  return false;
}

function formatarDocumentoFiscal(valor) {
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

function normalizarNumeroCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 19);
}

function formatarNumeroCartao(valor) {
  const digits = normalizarNumeroCartao(valor);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatarMesCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 2);
}

function formatarAnoCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 4);
}

function formatarCvvCartao(valor) {
  return String(valor || '').replace(/\D/g, '').slice(0, 4);
}

function normalizarNomeCompletoPara3DS(valor, fallback = 'Cliente Teste') {
  const base = String(valor || '').trim();
  const semCaracteresInvalidos = base
    .replace(/[^\p{L}\s'.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!semCaracteresInvalidos) {
    return fallback;
  }

  const partes = semCaracteresInvalidos.split(' ').filter(Boolean);
  if (partes.length >= 2) {
    return partes.join(' ');
  }

  return `${partes[0]} Teste`;
}

function normalizarTelefonePara3DS(telefone) {
  const digits = String(telefone || '').replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  const semPais = digits.startsWith('55') && digits.length >= 12
    ? digits.slice(2)
    : digits;
  if (semPais.length < 10) {
    return null;
  }

  const area = semPais.slice(0, 2);
  const number = semPais.slice(2);
  if (!area || !number) {
    return null;
  }

  return {
    country: '55',
    area,
    number,
    type: 'MOBILE'
  };
}

function normalizarNumeroEnderecoPara3DS(numero) {
  const digits = String(numero || '').replace(/\D/g, '').trim();
  const numeroInteiro = Number.parseInt(digits, 10);

  if (Number.isInteger(numeroInteiro) && numeroInteiro > 0) {
    return String(numeroInteiro);
  }

  return '1';
}

function construirEndereco3DS({ endereco, cepFallback } = {}) {
  const cepDigits = normalizarCep(endereco?.cep || cepFallback || '');
  const numeroEndereco = normalizarNumeroEnderecoPara3DS(endereco?.numero);
  const complementoEndereco = String(endereco?.complemento || '').trim();
  const endereco3DS = {
    street: String(endereco?.logradouro || 'Endereco').trim() || 'Endereco',
    number: numeroEndereco,
    regionCode: String(endereco?.estado || 'SP').trim().toUpperCase().slice(0, 2) || 'SP',
    country: 'BRA',
    city: String(endereco?.cidade || 'Sao Paulo').trim() || 'Sao Paulo',
    postalCode: cepDigits || '01001000'
  };

  if (complementoEndereco) {
    endereco3DS.complement = complementoEndereco;
  }

  return endereco3DS;
}

function mascararValorHomologacao(valor, { prefixo = 6, sufixo = 4 } = {}) {
  const texto = String(valor || '').trim();
  if (!texto) {
    return '';
  }

  if (texto.length <= prefixo + sufixo) {
    return `${texto.slice(0, 2)}***`;
  }

  return `${texto.slice(0, prefixo)}***${texto.slice(-sufixo)}`;
}

function mascararDocumentoHomologacao(valor) {
  const digits = normalizarDocumentoFiscal(valor);
  if (!digits) {
    return '';
  }

  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

function mascararTraceHomologacao(valor) {
  return mascararValorHomologacao(valor, { prefixo: 8, sufixo: 4 });
}

function sanitizarErrorMessages3DS(errorMessages) {
  if (!Array.isArray(errorMessages) || !errorMessages.length) {
    return [];
  }

  return errorMessages.slice(0, 8).map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const field = String(
        item.field
          || item.parameter_name
          || item.parameterName
          || item.parameter
          || item.property
          || item.path
          || item.pointer
          || item.target
          || item.name
          || ''
      ).trim() || null;
      const code = String(item.code || item.error || item.reason || '').trim() || null;
      const message = String(item.message || item.description || item.detail || '').trim() || null;

      return { field, code, message };
    }

    return {
      field: null,
      code: null,
      message: String(item || '').trim() || null
    };
  });
}

function sanitizarRequestPagamentoCartaoHomologacao({ payloadRequest, endpoint = '/api/pagamentos/cartao' } = {}) {
  const payload = (payloadRequest && typeof payloadRequest === 'object' && !Array.isArray(payloadRequest))
    ? payloadRequest
    : {};

  return {
    endpoint,
    pedido_id: Number.parseInt(String(payload?.pedido_id || ''), 10) || null,
    reference_id: payload?.pedido_id ? `pedido_${payload.pedido_id}` : null,
    tipo_cartao: String(payload?.tipo_cartao || '').trim().toLowerCase() || null,
    parcelas: Number.parseInt(String(payload?.parcelas || ''), 10) || 1,
    tax_id_masked: mascararDocumentoHomologacao(payload?.tax_id),
    token_cartao_masked: mascararValorHomologacao(payload?.token_cartao, { prefixo: 10, sufixo: 6 }),
    authentication_method: payload?.authentication_method
      ? {
        type: String(payload.authentication_method?.type || '').trim().toUpperCase() || null,
        id_masked: mascararValorHomologacao(payload.authentication_method?.id, { prefixo: 6, sufixo: 4 }) || null
      }
      : null,
    three_ds_result: payload?.three_ds_result
      ? {
        flow: String(payload.three_ds_result?.flow || '').trim() || null,
        status: String(payload.three_ds_result?.status || '').trim().toUpperCase() || null,
        id_masked: mascararValorHomologacao(payload.three_ds_result?.id, { prefixo: 6, sufixo: 4 }) || null,
        trace_id_masked: mascararTraceHomologacao(payload.three_ds_result?.trace_id || payload.three_ds_result?.traceId) || null
      }
      : null,
    recaptcha_token_present: Boolean(String(payload?.recaptcha_token || '').trim())
  };
}

function extrairStatusThreeDSChargeHomologacao(responsePayload) {
  const payload = (responsePayload && typeof responsePayload === 'object' && !Array.isArray(responsePayload))
    ? responsePayload
    : {};
  const raw = (payload?.raw && typeof payload.raw === 'object' && !Array.isArray(payload.raw))
    ? payload.raw
    : null;
  const chargePrincipal = Array.isArray(raw?.charges) ? raw.charges[0] || null : null;
  const candidatos = [
    payload?.status_charge_threeds,
    chargePrincipal?.threeds?.status,
    chargePrincipal?.three_ds?.status,
    chargePrincipal?.authentication_method?.status,
    chargePrincipal?.payment_method?.authentication_method?.status,
    chargePrincipal?.payment_method?.card?.threeds?.status,
    chargePrincipal?.payment_method?.card?.three_ds?.status
  ];

  for (const candidato of candidatos) {
    const valor = String(candidato || '').trim().toUpperCase();
    if (valor) {
      return valor;
    }
  }

  return null;
}

function montarResumoRespostaPagBankHomologacao({ responsePayload, pedidoId } = {}) {
  const payload = (responsePayload && typeof responsePayload === 'object' && !Array.isArray(responsePayload))
    ? responsePayload
    : {};
  const raw = (payload?.raw && typeof payload.raw === 'object' && !Array.isArray(payload.raw))
    ? payload.raw
    : null;
  const chargePrincipal = Array.isArray(raw?.charges) ? raw.charges[0] || null : null;
  const paymentResponse = (payload?.payment_response && typeof payload.payment_response === 'object')
    ? payload.payment_response
    : {};
  const paymentResponseRaw = chargePrincipal?.payment_response || {};
  const chargesStatus = String(
    payload?.status_charge
      || chargePrincipal?.status
      || payload?.status
      || ''
  ).trim().toUpperCase() || null;
  const chargeThreeDSStatus = extrairStatusThreeDSChargeHomologacao(payload);
  const paymentResponseCode = String(
    paymentResponse?.code
      || paymentResponseRaw?.code
      || payload?.authorization_code
      || ''
  ).trim() || null;
  const paymentResponseMessage = String(
    paymentResponse?.message
      || paymentResponseRaw?.message
      || payload?.message
      || ''
  ).trim() || null;
  const authenticationId3DS = String(payload?.authentication_id_3ds || '').trim();
  const traceId = String(payload?.trace_id || '').trim();
  const referenceId = String(
    payload?.reference_id
      || raw?.reference_id
      || (pedidoId ? `pedido_${pedidoId}` : '')
  ).trim();

  return {
    endpoint: '/api/pagamentos/cartao',
    pedido_id: Number.parseInt(String(pedidoId || payload?.pedido_id || ''), 10) || null,
    reference_id: referenceId || null,
    pagbank_order_id: String(payload?.pagbank_order_id || raw?.id || '').trim() || null,
    charges: {
      status: chargesStatus,
      threeds: {
        status: chargeThreeDSStatus
      }
    },
    payment_response: {
      code: paymentResponseCode,
      message: paymentResponseMessage
    },
    three_ds_validation: {
      status: String(payload?.three_ds_status || '').trim().toUpperCase() || null,
      codigo: String(payload?.three_ds_codigo || '').trim().toUpperCase() || null,
      authentication_id_masked: authenticationId3DS
        ? mascararValorHomologacao(authenticationId3DS, { prefixo: 6, sufixo: 4 })
        : null
    },
    trace_id_masked: traceId ? mascararTraceHomologacao(traceId) : null,
    response_final_pagbank_masked: raw
      ? {
        id: String(raw?.id || '').trim() || null,
        reference_id: String(raw?.reference_id || '').trim() || null,
        status: String(raw?.status || '').trim().toUpperCase() || null,
        charges: chargePrincipal
          ? [
            {
              id: String(chargePrincipal?.id || '').trim() || null,
              reference_id: String(chargePrincipal?.reference_id || '').trim() || null,
              status: String(chargePrincipal?.status || '').trim().toUpperCase() || null,
              threeds: {
                status: chargeThreeDSStatus
              },
              payment_response: {
                code: paymentResponseCode,
                message: paymentResponseMessage
              }
            }
          ]
          : []
      }
      : null
  };
}

const STATUS_PEDIDO_LABELS = {
  pendente: 'Aguardando confirmação',
  preparando: 'Em preparação',
  enviado: 'Saiu para entrega',
  pronto_para_retirada: 'Pronto para retirada',
  retirado: 'Retirado na loja',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  pago: 'Pago'
};

const STATUS_PAGAMENTO_LABELS = {
  WAITING: 'Aguardando pagamento',
  IN_ANALYSIS: 'Em análise',
  AUTHORIZED: 'Autorizado',
  PAID: 'Pagamento aprovado',
  DECLINED: 'Pagamento recusado',
  CANCELED: 'Pagamento cancelado',
  EXPIRED: 'Pagamento expirado'
};

const PIX_STATUS_META = {
  WAITING: {
    tone: 'warning',
    icon: '⏳',
    guidance: 'Aguardando confirmação do banco. Assim que for aprovado, a etapa de confirmação será liberada.'
  },
  IN_ANALYSIS: {
    tone: 'info',
    icon: '🔎',
    guidance: 'Seu pagamento está em análise. Isso pode levar alguns instantes.'
  },
  AUTHORIZED: {
    tone: 'info',
    icon: '🛡️',
    guidance: 'Pagamento autorizado. A confirmação final será atualizada automaticamente.'
  },
  PAID: {
    tone: 'success',
    icon: '✅',
    guidance: 'Pagamento confirmado com sucesso. Você já pode seguir para a confirmação do pedido.'
  },
  EXPIRED: {
    tone: 'danger',
    icon: '⌛',
    guidance: 'Este PIX expirou. Gere um novo QR Code para tentar novamente.'
  },
  CANCELED: {
    tone: 'danger',
    icon: '⛔',
    guidance: 'Pagamento cancelado. Gere um novo PIX para concluir o pedido.'
  },
  DECLINED: {
    tone: 'danger',
    icon: '⚠️',
    guidance: 'Pagamento não aprovado. Gere um novo PIX e tente novamente.'
  }
};

function resolverStatusPix({ status, statusInterno, pagamentoConfirmado }) {
  const statusNormalizado = String(status || '').trim().toUpperCase();
  if (statusNormalizado) {
    return statusNormalizado;
  }

  const statusInternoNormalizado = String(statusInterno || '').trim().toLowerCase();
  if (pagamentoConfirmado || statusInternoNormalizado === 'pago' || statusInternoNormalizado === 'entregue') {
    return 'PAID';
  }

  if (statusInternoNormalizado === 'cancelado') {
    return 'CANCELED';
  }

  return 'WAITING';
}

function obterStatusPixVisual({ status, statusInterno, pagamentoConfirmado }) {
  const code = resolverStatusPix({ status, statusInterno, pagamentoConfirmado });
  const meta = PIX_STATUS_META[code] || {
    tone: 'neutral',
    icon: 'ℹ️',
    guidance: 'Atualize o status para confirmar a situação do pagamento.'
  };

  return {
    code,
    tone: meta.tone,
    icon: meta.icon,
    label: formatarStatusPagamento(code),
    guidance: meta.guidance,
    aprovado: code === 'PAID'
  };
}

function formatarStatusPedido(statusRaw) {
  const status = String(statusRaw || '').trim().toLowerCase();
  return STATUS_PEDIDO_LABELS[status] || 'Em análise';
}

function formatarStatusPagamento(statusRaw) {
  const status = String(statusRaw || '').trim().toUpperCase();
  return STATUS_PAGAMENTO_LABELS[status] || 'Em processamento';
}

function BotaoVoltarSeta({ onClick, label, disabled = false, text = '', className = '' }) {
  return (
    <button
      className={`btn-secondary entrega-voltar-carrinho-btn ${text ? 'has-text' : ''} ${className}`.trim()}
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      <span className="entrega-voltar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 5.5L8 12L14.5 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {text ? <span className="entrega-voltar-label">{text}</span> : null}
    </button>
  );
}

function LinkVoltarSeta({ to, label, text = '', className = '' }) {
  return (
    <Link
      to={to}
      className={`btn-secondary entrega-voltar-carrinho-btn ${text ? 'has-text' : ''} ${className}`.trim()}
      aria-label={label}
    >
      <span className="entrega-voltar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 5.5L8 12L14.5 18.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {text ? <span className="entrega-voltar-label">{text}</span> : null}
    </Link>
  );
}

function CheckoutStepper({ currentIndex }) {
  return (
    <ol className="checkout-steps" aria-label="Etapas do checkout">
      {CHECKOUT_STEPS.map((titulo, index) => {
        const estado = index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'upcoming';
        return (
          <li
            key={titulo}
            className={`checkout-step is-${estado}`}
            aria-current={estado === 'current' ? 'step' : undefined}
          >
            <span className="checkout-step-index" aria-hidden="true">
              {estado === 'completed' ? '✓' : index + 1}
            </span>
            <span className="checkout-step-label">{titulo}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CheckoutContextBanner({ tone = 'neutral', title, description, chips = [] }) {
  return (
    <article
      className={`checkout-context-banner is-${tone}`.trim()}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <p className="checkout-context-title">{title}</p>
      <p className="checkout-context-description">{description}</p>

      {chips.length > 0 ? (
        <ul className="checkout-context-chips" aria-label="Orientações rápidas desta etapa">
          {chips.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function CheckoutGuidanceChips({ items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <ul className="checkout-guidance-chips" aria-label="Passos recomendados">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function CheckoutMobileActionBar({
  visible,
  stepLabel,
  totalLabel,
  caption,
  primaryLabel,
  onPrimaryClick,
  primaryDisabled = false,
  secondaryLabel = '',
  secondaryTo = '',
  onSecondaryClick,
  secondaryDisabled = false
}) {
  if (!visible || !primaryLabel) {
    return null;
  }

  return (
    <div className="checkout-mobile-action-bar" aria-label="Ações rápidas da etapa atual">
      <div className="checkout-mobile-action-meta">
        <p className="checkout-mobile-action-step">{stepLabel}</p>
        <strong className="checkout-mobile-action-total">{totalLabel}</strong>
        {caption ? <p className="checkout-mobile-action-caption">{caption}</p> : null}
      </div>

      <div className="checkout-mobile-action-buttons">
        {secondaryLabel ? (
          secondaryTo ? (
            <Link className="btn-secondary checkout-mobile-secondary-btn" to={secondaryTo}>
              {secondaryLabel}
            </Link>
          ) : (
            <button
              className="btn-secondary checkout-mobile-secondary-btn"
              type="button"
              onClick={onSecondaryClick}
              disabled={secondaryDisabled}
            >
              {secondaryLabel}
            </button>
          )
        ) : null}

        <button
          className="btn-primary checkout-mobile-primary-btn"
          type="button"
          onClick={onPrimaryClick}
          disabled={primaryDisabled}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

function DeliveryOptionCard({
  veiculo,
  selecionado,
  recomendado,
  onSelect
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      className={`delivery-option-card ${selecionado ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <div className="delivery-option-head">
        <div className="delivery-option-icon-wrap" aria-hidden="true">
          <SmartImage src={veiculo.imagem} alt="" className="delivery-option-icon" loading="lazy" />
        </div>

        <div className="delivery-option-title-wrap">
          <p className="delivery-option-title-row">
            <span className="delivery-option-title">{veiculo.label}</span>
            {recomendado ? <span className="delivery-option-badge">Mais recomendado</span> : null}
          </p>
          <p className="delivery-option-description">{veiculo.descricao}</p>
        </div>

        {selecionado ? <span className="delivery-option-check" aria-hidden="true">✓</span> : null}
      </div>

      <p className="delivery-option-advantage">{veiculo.vantagem}</p>
      <p className="delivery-option-meta">
        {veiculo.icone} {veiculo.consumo} • {veiculo.observacao}
      </p>
    </button>
  );
}

function DeliverySummaryCard({
  veiculoLabel,
  cepDestino,
  distanciaTexto,
  freteTexto,
  totalTexto,
  cepOrigem,
  numeroOrigem
}) {
  return (
    <article className="delivery-summary-card" aria-label="Resumo da entrega selecionada">
      <div className="delivery-summary-card-head">
        <div>
          <p className="delivery-summary-kicker">Entrega selecionada</p>
          <h3>{veiculoLabel}</h3>
        </div>
        <span className="delivery-summary-icon" aria-hidden="true">📦</span>
      </div>

      <div className="delivery-summary-grid">
        <div>
          <span className="delivery-summary-label">CEP de destino</span>
          <strong>{cepDestino}</strong>
        </div>
        <div>
          <span className="delivery-summary-label">Distância estimada</span>
          <strong>{distanciaTexto}</strong>
        </div>
        <div>
          <span className="delivery-summary-label">Frete</span>
          <strong className="delivery-summary-frete">{freteTexto}</strong>
        </div>
        <div>
          <span className="delivery-summary-label">Total com entrega</span>
          <strong className="delivery-summary-total">{totalTexto}</strong>
        </div>
      </div>

      <p className="delivery-summary-origin">Origem: CEP {cepOrigem}, nº {numeroOrigem}</p>
    </article>
  );
}

function DeliveryModeSelector({ tipoEntrega, onChange }) {
  return (
    <section className="checkout-delivery-section" aria-label="Tipo de atendimento">
      <div className="checkout-delivery-section-head">
        <h3>Como voce prefere receber?</h3>
        <p>Escolha entre entrega no endereco ou retirada na loja.</p>
      </div>

      <div className="delivery-mode-toggle" role="radiogroup" aria-label="Tipo de entrega">
        <button
          type="button"
          role="radio"
          aria-checked={tipoEntrega === 'entrega'}
          className={`delivery-mode-toggle-btn ${tipoEntrega === 'entrega' ? 'is-active' : ''}`.trim()}
          onClick={() => onChange('entrega')}
        >
          Entrega
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={tipoEntrega === 'retirada'}
          className={`delivery-mode-toggle-btn ${tipoEntrega === 'retirada' ? 'is-active' : ''}`.trim()}
          onClick={() => onChange('retirada')}
        >
          Retirada na loja
        </button>
      </div>
    </section>
  );
}

function PickupStoreCard({ economiaFrete = 0 }) {
  const economiaTexto = Number(economiaFrete || 0) > 0
    ? formatarMoeda(economiaFrete)
    : 'Sem custo de frete';

  return (
    <article className="pickup-store-card" aria-label="Informacoes para retirada na loja">
      <div className="pickup-store-card-head">
        <div>
          <p className="pickup-store-kicker">Retirada na loja</p>
          <h3>{RETIRADA_LOJA_INFO.nome}</h3>
        </div>
        <span className="pickup-store-icon" aria-hidden="true">🏪</span>
      </div>

      <div className="pickup-store-grid">
        <div>
          <span>Endereco</span>
          <strong>{RETIRADA_LOJA_INFO.endereco}</strong>
        </div>
        <div>
          <span>Horario de funcionamento</span>
          <strong>{RETIRADA_LOJA_INFO.horario}</strong>
        </div>
        <div>
          <span>Tempo estimado</span>
          <strong>{RETIRADA_LOJA_INFO.tempo_estimado}</strong>
        </div>
        <div>
          <span>Economia no frete</span>
          <strong className="pickup-store-economia">{economiaTexto}</strong>
        </div>
      </div>
    </article>
  );
}

function DeliveryAddressLookupCard({
  cep,
  endereco,
  carregando,
  erro,
  cepIncompleto
}) {
  const estadoVisual = carregando
    ? 'loading'
    : erro
      ? 'error'
      : endereco
        ? 'success'
        : 'neutral';

  const rua = String(endereco?.logradouro || '').trim();
  const bairro = String(endereco?.bairro || '').trim();
  const cidade = String(endereco?.cidade || '').trim();
  const estado = String(endereco?.estado || '').trim();

  const linhaPrincipal = [rua, bairro].filter(Boolean).join(', ');
  const linhaSecundaria = [cidade, estado].filter(Boolean).join(' - ');

  return (
    <article
      className={`delivery-address-card is-${estadoVisual}`}
      role={estadoVisual === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <p className="delivery-address-kicker">Endereço do CEP {cep}</p>

      {carregando ? (
        <p className="delivery-address-line">Buscando endereço...</p>
      ) : erro ? (
        <p className="delivery-address-line">{erro}</p>
      ) : endereco ? (
        <>
          <p className="delivery-address-line">{linhaPrincipal || 'Logradouro não identificado para este CEP.'}</p>
          <p className="delivery-address-subline">{linhaSecundaria || 'Cidade/UF não identificada.'}</p>
        </>
      ) : cepIncompleto ? (
        <p className="delivery-address-line">Digite os 8 dígitos do CEP para identificar o endereço.</p>
      ) : (
        <p className="delivery-address-line">Informe um CEP para consultar o endereço.</p>
      )}
    </article>
  );
}

function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove
}) {
  const quantidade = Math.max(1, Number(item?.quantidade || 1));
  const precoUnitario = Number(item?.preco || 0);
  const subtotal = Number((precoUnitario * quantidade).toFixed(2));
  const imagem = String(item?.imagem || '').trim();
  const categoria = String(item?.categoria || '').trim();
  const unidade = String(item?.unidade || '').trim();
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const exibirImagem = Boolean(imagem) && !imagemFalhou;

  const unidadeLabel = unidade
    ? unidade.toLowerCase() === 'un'
      ? 'Unidade'
      : unidade
    : '';

  const meta = [categoria, unidadeLabel].filter(Boolean).join(' • ');

  return (
    <article className="cart-item-row" aria-label={`Item ${item.nome}`}>
      <div className="cart-item-media" aria-hidden="true">
        {exibirImagem ? (
          <SmartImage
            src={imagem}
            alt=""
            className="cart-item-image"
            loading="lazy"
            onError={() => setImagemFalhou(true)}
          />
        ) : (
          <span className="cart-item-emoji" aria-hidden="true">{item.emoji || '📦'}</span>
        )}
      </div>

      <div className="cart-item-main">
        <p className="cart-item-name">{item.nome}</p>
        <p className="cart-item-meta">{meta || 'Produto selecionado para o pedido'}</p>
        <p className="cart-item-unitary">
          Unitário: <strong>{formatarMoeda(precoUnitario)}</strong>
        </p>
      </div>

      <div className="cart-item-qty" aria-label={`Quantidade de ${item.nome}`}>
        <button
          type="button"
          className="cart-item-qty-btn"
          onClick={() => onUpdateQuantity(item.id, Math.max(1, quantidade - 1))}
          disabled={quantidade <= 1}
          aria-label={`Diminuir quantidade de ${item.nome}`}
        >
          -
        </button>

        <input
          className="cart-item-qty-input"
          type="number"
          min="1"
          value={quantidade}
          onChange={(event) => {
            const digits = String(event.target.value || '').replace(/\D/g, '');
            const proximaQuantidade = Number.parseInt(digits || '1', 10);
            onUpdateQuantity(item.id, Math.max(1, Number.isFinite(proximaQuantidade) ? proximaQuantidade : 1));
          }}
          aria-label={`Quantidade de ${item.nome}`}
        />

        <button
          type="button"
          className="cart-item-qty-btn"
          onClick={() => onUpdateQuantity(item.id, quantidade + 1)}
          aria-label={`Aumentar quantidade de ${item.nome}`}
        >
          +
        </button>
      </div>

      <div className="cart-item-subtotal">
        <span>Subtotal</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <button
        type="button"
        className="cart-item-remove-btn"
        onClick={() => onRemove(item.id)}
        aria-label={`Remover ${item.nome} do carrinho`}
      >
        Remover
      </button>
    </article>
  );
}

function CheckoutSummaryCard({
  itens,
  produtosDistintos,
  subtotal,
  tipoEntrega = 'entrega',
  economiaFrete = 0,
  onContinue,
  onClearCart,
  disabled
}) {
  const retirada = String(tipoEntrega || '').trim().toLowerCase() === 'retirada';

  return (
    <aside className="checkout-cart-summary-card" aria-label="Resumo da etapa de carrinho">
      <p className="checkout-cart-summary-kicker">Resumo do carrinho</p>
      <h3>Revisão da compra</h3>

      <div className="checkout-cart-summary-row">
        <span>Itens</span>
        <strong>{formatarQuantidadeItens(itens)}</strong>
      </div>

      <div className="checkout-cart-summary-row">
        <span>Produtos diferentes</span>
        <strong>{produtosDistintos}</strong>
      </div>

      <div className="checkout-cart-summary-row">
        <span>Subtotal</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="checkout-cart-summary-row">
        <span>Frete</span>
        <strong>{retirada ? 'Sem frete' : 'Calculado na etapa de entrega'}</strong>
      </div>

      {retirada ? (
        <div className="checkout-cart-summary-row is-savings">
          <span>Economia no frete</span>
          <strong>{Number(economiaFrete || 0) > 0 ? formatarMoeda(economiaFrete) : 'Sem custo adicional'}</strong>
        </div>
      ) : null}

      <div className="checkout-cart-summary-divider" aria-hidden="true" />

      <div className="checkout-cart-summary-row is-total">
        <span>Total previsto</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <button
        className="btn-primary checkout-cart-summary-btn"
        type="button"
        onClick={onContinue}
        disabled={disabled}
      >
        Continuar para entrega • {formatarMoeda(subtotal)}
      </button>

      <button
        className="btn-secondary checkout-cart-summary-clear-btn"
        type="button"
        onClick={onClearCart}
        disabled={disabled}
      >
        Esvaziar carrinho
      </button>

      <p className="checkout-cart-summary-note">Você só confirma o pagamento nas próximas etapas. Frete e prazo aparecem na entrega.</p>
    </aside>
  );
}

function OrderSummaryCard({
  itens,
  subtotal,
  frete,
  total,
  tipoEntrega = 'entrega',
  economiaFrete = 0,
  veiculoLabel,
  className = ''
}) {
  const itensExibicao = Number.isFinite(Number(itens))
    ? formatarQuantidadeItens(Number(itens))
    : itens;
  const retirada = String(tipoEntrega || '').trim().toLowerCase() === 'retirada';

  return (
    <aside className={`checkout-order-summary ${className}`.trim()} aria-label="Resumo do pedido">
      <p className="checkout-order-summary-kicker">Resumo do pedido</p>
      <h3>Total da compra</h3>

      <div className="checkout-order-summary-row">
        <span>Itens</span>
        <strong>{itensExibicao}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Produtos</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Frete</span>
        <strong>{frete === null ? 'A calcular' : retirada ? 'Sem frete' : formatarMoeda(frete)}</strong>
      </div>

      <div className="checkout-order-summary-row">
        <span>Atendimento</span>
        <strong>{veiculoLabel}</strong>
      </div>

      {retirada ? (
        <div className="checkout-order-summary-row is-savings">
          <span>Economia no frete</span>
          <strong>{Number(economiaFrete || 0) > 0 ? formatarMoeda(economiaFrete) : 'Sem custo adicional'}</strong>
        </div>
      ) : null}

      <div className="checkout-order-summary-divider" aria-hidden="true" />

      <div className="checkout-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>
    </aside>
  );
}

function PaymentMethodCard({
  icon,
  title,
  headline,
  details,
  selecionado,
  onSelect,
  disabled = false
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selecionado}
      className={`payment-method-card ${selecionado ? 'is-selected' : ''}`}
      onClick={onSelect}
      disabled={disabled}
    >
      <div className="payment-method-card-head">
        <p className="payment-method-title-row">
          <span className="payment-method-icon" aria-hidden="true">{icon}</span>
          <span className="payment-method-title">{title}</span>
          {selecionado ? <span className="payment-method-badge">Selecionado</span> : null}
        </p>
        {selecionado ? <span className="payment-method-check" aria-hidden="true">✓</span> : null}
      </div>

      <p className="payment-method-headline">{headline}</p>
      <ul className="payment-method-list">
        {details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </button>
  );
}

function PaymentSelectionSummary({ title, description }) {
  return (
    <article className="payment-selection-summary" aria-label="Resumo da forma de pagamento selecionada">
      <div className="payment-selection-summary-head">
        <p className="payment-selection-summary-kicker">Forma selecionada</p>
        <h3>{title}</h3>
      </div>

      {description.map((line) => (
        <p className="payment-selection-summary-line" key={line}>{line}</p>
      ))}
    </article>
  );
}

function CheckoutSecurityTrust({
  formaPagamento = 'pix',
  total = 0,
  frete = null,
  retiradaSelecionada = false,
  recaptchaEnabled = false,
  compact = false
}) {
  const metodoLabel = formaPagamento === 'debito'
    ? 'Cartao de debito'
    : formaPagamento === 'credito'
      ? 'Cartao de credito'
      : 'PIX';

  const linhaFrete = retiradaSelecionada
    ? 'Retirada na loja ativa: sem custo de frete.'
    : frete === null
      ? 'Frete exibido separadamente assim que o CEP for confirmado.'
      : `Frete separado no resumo: ${formatarMoeda(frete)}.`;

  const linhaMetodo = formaPagamento === 'pix'
    ? 'QR Code oficial e codigo copia e cola vinculados ao seu pedido.'
    : 'Dados de cartao protegidos por tokenizacao antes de enviar ao gateway.';

  return (
    <article
      className={`checkout-security-trust ${compact ? 'is-compact' : ''}`.trim()}
      aria-label="Seguranca e clareza de valores no checkout"
    >
      <div className="checkout-security-trust-head">
        <p className="checkout-security-trust-kicker">Confianca no checkout</p>
        <strong>Pagamento protegido e total transparente</strong>
      </div>

      <ul className="checkout-security-trust-list">
        <li>{recaptchaEnabled ? 'Validacao antiabuso ativa nesta etapa.' : 'Ambiente com protecao ativa para finalizacao.'}</li>
        <li>{linhaMetodo}</li>
        <li>{linhaFrete}</li>
      </ul>

      <p className="checkout-security-trust-total">
        Metodo atual: <strong>{metodoLabel}</strong> • Total em revisao: <strong>{formatarMoeda(total)}</strong>
      </p>
    </article>
  );
}

function PaymentOrderSummary({ itens, subtotal, frete, total, metodo, tipoEntrega = 'entrega', economiaFrete = 0, className = '' }) {
  const itensNumerico = Number(itens);
  const itensExibicao = Number.isFinite(Number(itens))
    ? formatarQuantidadeItens(Number(itens))
    : itens;
  const retirada = String(tipoEntrega || '').trim().toLowerCase() === 'retirada';
  const subtotalNumerico = Number(subtotal || 0);
  const totalNumerico = Number(total || 0);
  const freteNumerico = frete === null ? null : Number(frete || 0);
  const valorMedioPorItem = Number.isFinite(itensNumerico) && itensNumerico > 0
    ? Number((totalNumerico / itensNumerico).toFixed(2))
    : null;
  const linhaConferencia = freteNumerico === null
    ? 'Total parcial exibido. O frete sera somado apos a simulacao de entrega.'
    : retirada
      ? `Conferencia: ${formatarMoeda(subtotalNumerico)} + sem frete = ${formatarMoeda(totalNumerico)}.`
      : `Conferencia: ${formatarMoeda(subtotalNumerico)} + ${formatarMoeda(freteNumerico)} = ${formatarMoeda(totalNumerico)}.`;

  return (
    <aside className={`payment-order-summary ${className}`.trim()} aria-label="Resumo financeiro da etapa de pagamento">
      <p className="payment-order-summary-kicker">Resumo do pedido</p>
      <h3>Quanto você vai pagar</h3>

      <div className="payment-order-summary-row">
        <span>Itens</span>
        <strong>{itensExibicao}</strong>
      </div>

      <div className="payment-order-summary-row">
        <span>Produtos</span>
        <strong>{formatarMoeda(subtotal)}</strong>
      </div>

      <div className="payment-order-summary-row">
        <span>Frete</span>
        <strong>{frete === null ? 'A calcular' : retirada ? 'Sem frete' : formatarMoeda(frete)}</strong>
      </div>

      {valorMedioPorItem !== null ? (
        <div className="payment-order-summary-row is-average">
          <span>Media por item</span>
          <strong>{formatarMoeda(valorMedioPorItem)}</strong>
        </div>
      ) : null}

      {retirada ? (
        <div className="payment-order-summary-row is-savings">
          <span>Economia no frete</span>
          <strong>{Number(economiaFrete || 0) > 0 ? formatarMoeda(economiaFrete) : 'Sem custo adicional'}</strong>
        </div>
      ) : null}

      <div className="payment-order-summary-row">
        <span>Pagamento</span>
        <strong>{metodo}</strong>
      </div>

      <div className="payment-order-summary-divider" aria-hidden="true" />

      <div className="payment-order-summary-row is-total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>

      <p className="payment-order-summary-clarity">{linhaConferencia}</p>
    </aside>
  );
}

function TaxIdInput({ value, onChange, onBlur, requiredError, invalidError, validFeedback }) {
  const feedbackTone = requiredError || invalidError ? 'is-error' : validFeedback ? 'is-valid' : 'is-neutral';
  const feedbackText = requiredError
    ? 'Campo obrigatório para concluir o pagamento.'
    : invalidError
      ? 'Documento inválido. Digite CPF com 11 dígitos ou CNPJ com 14 dígitos.'
      : validFeedback
        ? 'Documento válido para processar o pagamento.'
        : 'Obrigatório para pagamentos via PIX e cartão no PagBank.';

  return (
    <div className={`payment-taxid ${feedbackTone}`.trim()}>
      <label htmlFor="documento-pagador" className="payment-taxid-label">
        CPF/CNPJ do pagador
      </label>

      <input
        id="documento-pagador"
        className="field-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00 ou 00.000.000/0000-00"
        maxLength={18}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={requiredError || invalidError ? 'true' : undefined}
      />

      <p className={`payment-taxid-feedback ${feedbackTone}`.trim()} role={requiredError || invalidError ? 'alert' : 'status'}>
        {feedbackText}
      </p>
    </div>
  );
}

function PixStatusCard({ statusVisual }) {
  return (
    <article className={`pix-status-card is-${statusVisual.tone}`.trim()} aria-label="Status do pagamento PIX">
      <div className="pix-status-head">
        <p className="pix-status-kicker">Status do pagamento</p>
        <span className={`pix-status-badge is-${statusVisual.tone}`.trim()}>
          <span aria-hidden="true">{statusVisual.icon}</span>
          <strong>{statusVisual.label}</strong>
        </span>
      </div>
      <p className="pix-status-guidance">{statusVisual.guidance}</p>
    </article>
  );
}

function PixQrCodeCard({ qrCodeSrc, carregando }) {
  const estadoQr = carregando ? 'loading' : qrCodeSrc ? 'ready' : 'empty';

  return (
    <article className="pix-qr-card" aria-label="QR Code PIX">
      <p className="pix-card-title">QR Code PIX</p>

      <div className={`pix-qr-frame is-${estadoQr}`.trim()}>
        {carregando ? (
          <div className="pix-qr-placeholder-block" role="status" aria-live="polite">
            <span className="pix-qr-placeholder-icon" aria-hidden="true">⏳</span>
            <p className="pix-qr-placeholder-title">Gerando QR Code...</p>
            <p className="pix-qr-placeholder">Aguarde alguns segundos enquanto criamos o código PIX.</p>
          </div>
        ) : qrCodeSrc ? (
          <SmartImage className="pix-qr-image" src={qrCodeSrc} alt="QR Code para pagamento PIX" priority />
        ) : (
          <div className="pix-qr-placeholder-block">
            <span className="pix-qr-placeholder-icon" aria-hidden="true">◻</span>
            <p className="pix-qr-placeholder-title">QR Code ainda não gerado</p>
            <p className="pix-qr-placeholder">Clique em Gerar QR Code PIX para iniciar o pagamento no app do banco.</p>
          </div>
        )}
      </div>
    </article>
  );
}

function PixCopyCodeCard({ codigoPix, onCopy, feedbackCopia, disabled }) {
  return (
    <article className="pix-copy-card" aria-label="Código PIX copia e cola">
      <p className="pix-card-title">Código PIX copia e cola</p>

      <div className="pix-copy-code-field" role="textbox" aria-readonly="true" tabIndex={0}>
        {codigoPix || 'Gere o QR Code para exibir o código PIX.'}
      </div>

      <button
        className="btn-secondary pix-copy-btn"
        type="button"
        onClick={onCopy}
        disabled={disabled || !codigoPix}
      >
        Copiar código
      </button>

      {feedbackCopia ? (
        <p className="pix-copy-feedback" role="status">{feedbackCopia}</p>
      ) : null}
    </article>
  );
}

function PixInstructionsCard() {
  return (
    <article className="pix-instructions-card" aria-label="Como pagar com PIX">
      <p className="pix-card-title">Como pagar com PIX</p>
      <ol className="pix-instructions-list">
        <li>Abra o app do seu banco.</li>
        <li>Escaneie o QR Code ou copie o código PIX.</li>
        <li>Após o pagamento, clique em verificar para atualizar o status.</li>
      </ol>
    </article>
  );
}

export default function PagamentoPage() {
  const { itens, resumo, updateItemQuantity, removeItem, clearCart } = useCart();
  const [resultadoPedido, setResultadoPedido] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [feedbackCarrinho, setFeedbackCarrinho] = useState('');
  const [dadosUsuarioCheckout, setDadosUsuarioCheckout] = useState(null);
  const [resultadoPix, setResultadoPix] = useState(null);
  const [qrCodePixDataUrl, setQrCodePixDataUrl] = useState('');
  const [feedbackCopiaPix, setFeedbackCopiaPix] = useState('');
  const [verificandoStatusPix, setVerificandoStatusPix] = useState(false);
  const [resumoPedidoSnapshot, setResumoPedidoSnapshot] = useState(null);
  const [itensPedidoSnapshot, setItensPedidoSnapshot] = useState([]);
  const [etapaAtual, setEtapaAtual] = useState(ETAPAS.CARRINHO);
  const [statusPedidoAtual, setStatusPedidoAtual] = useState('');
  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
  const [autenticado, setAutenticado] = useState(null);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [tipoEntrega, setTipoEntrega] = useState('entrega');
  const [cepEntrega, setCepEntrega] = useState('');
  const [veiculoEntrega, setVeiculoEntrega] = useState('moto');
  const [ultimoFreteEntrega, setUltimoFreteEntrega] = useState(0);
  const [simulacaoFrete, setSimulacaoFrete] = useState(null);
  const [simulandoFrete, setSimulandoFrete] = useState(false);
  const [erroEntrega, setErroEntrega] = useState('');
  const [enderecoCepEntrega, setEnderecoCepEntrega] = useState(null);
  const [buscandoEnderecoCepEntrega, setBuscandoEnderecoCepEntrega] = useState(false);
  const [erroEnderecoCepEntrega, setErroEnderecoCepEntrega] = useState('');
  const [cepEnderecoConsultado, setCepEnderecoConsultado] = useState('');
  const [documentoPagador, setDocumentoPagador] = useState('');
  const [documentoTocado, setDocumentoTocado] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [pagBankPublicKey, setPagBankPublicKey] = useState('');
  const [buscandoChavePublica, setBuscandoChavePublica] = useState(false);
  const [tokenCartao, setTokenCartao] = useState('');
  const [criptografandoCartao, setCriptografandoCartao] = useState(false);
  const [nomeTitularCartao, setNomeTitularCartao] = useState('');
  const [numeroCartao, setNumeroCartao] = useState('');
  const [mesExpiracaoCartao, setMesExpiracaoCartao] = useState('');
  const [anoExpiracaoCartao, setAnoExpiracaoCartao] = useState('');
  const [cvvCartao, setCvvCartao] = useState('');
  const [parcelasCartao, setParcelasCartao] = useState('1');
  const [resultadoCartao, setResultadoCartao] = useState(null);
  const [sessao3DS, setSessao3DS] = useState('');
  const [sessao3DSEnv, setSessao3DSEnv] = useState('SANDBOX');
  const [sessao3DSGeradaEm, setSessao3DSGeradaEm] = useState(0);
  const [status3DS, setStatus3DS] = useState('idle');
  const [resultado3DS, setResultado3DS] = useState(null);
  const [idAutenticacao3DS, setIdAutenticacao3DS] = useState('');
  const [eventosHomologacao3DS, setEventosHomologacao3DS] = useState([]);
  const [feedbackEvidencia3DS, setFeedbackEvidencia3DS] = useState('');
  const [growthVersion, setGrowthVersion] = useState(0);
  const [recaptchaCheckoutToken, setRecaptchaCheckoutToken] = useState('');
  const [recaptchaCheckoutErroCarregamento, setRecaptchaCheckoutErroCarregamento] = useState('');
  const recaptchaCheckoutRef = useRef(null);
  const pagandoCartaoRef = useRef(false);
  const buscaEnderecoRef = useRef(0);
  const startCheckoutTrackedRef = useRef(false);
  const purchaseTrackedOrdersRef = useRef(new Set());
  const growthInsights = useMemo(() => getGrowthInsights({ windowDays: 7 }), [growthVersion]);
  const growthCheckoutPaymentConfig = growthInsights?.experiment?.ui?.checkoutPayment || {
    enabled: false,
    ctaPrefix: 'Finalizar pedido',
    badgeLabel: '',
    priceHighlight: 'none'
  };
  const growthCheckoutPaymentEnabled = Boolean(growthCheckoutPaymentConfig.enabled);
  const growthCheckoutPaymentPriceClass = growthCheckoutPaymentEnabled
    ? `is-growth-${String(growthCheckoutPaymentConfig.priceHighlight || 'none').trim() || 'none'}`
    : '';
  const growthCheckoutPaymentBadge = growthCheckoutPaymentEnabled
    ? String(growthCheckoutPaymentConfig.badgeLabel || '').trim()
    : '';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleGrowthUpdate = () => {
      setGrowthVersion((atual) => atual + 1);
    };

    window.addEventListener(GROWTH_UPDATE_EVENT_NAME, handleGrowthUpdate);
    return () => {
      window.removeEventListener(GROWTH_UPDATE_EVENT_NAME, handleGrowthUpdate);
    };
  }, []);

  const itensPedido = useMemo(
    () =>
      itens.map((item) => ({
        produto_id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        quantidade: Number(item.quantidade || 1)
      })),
    [itens]
  );

  const handleAtualizarQuantidadeCarrinho = useCallback((id, quantidade) => {
    const itemAtual = itens.find((item) => item.id === Number(id));
    const quantidadeAnterior = Math.max(1, Number(itemAtual?.quantidade || 1));
    const proximaQuantidade = Math.max(1, Number(quantidade || 1));

    updateItemQuantity(id, proximaQuantidade);

    if (!itemAtual || proximaQuantidade === quantidadeAnterior) {
      return;
    }

    const variacao = proximaQuantidade > quantidadeAnterior ? 'aumentada' : 'reduzida';
    setFeedbackCarrinho(`${itemAtual.nome}: quantidade ${variacao} para ${proximaQuantidade}.`);
  }, [itens, updateItemQuantity]);

  const handleRemoverItemCarrinho = useCallback((id) => {
    const itemAtual = itens.find((item) => item.id === Number(id));
    removeItem(id);

    if (itemAtual) {
      setFeedbackCarrinho(`${itemAtual.nome} foi removido do carrinho.`);
    }
  }, [itens, removeItem]);

  const handleLimparCarrinho = useCallback(() => {
    if (!itens.length) {
      return;
    }

    clearCart();
    setFeedbackCarrinho('Carrinho esvaziado. Você pode continuar comprando quando quiser.');
  }, [clearCart, itens.length]);

  const retiradaSelecionada = tipoEntrega === 'retirada';
  const freteAtual = retiradaSelecionada ? 0 : Number(simulacaoFrete?.frete || 0);
  const economiaFreteRetirada = Number(ultimoFreteEntrega || simulacaoFrete?.frete || 0);

  const totalComFreteAtual = useMemo(
    () => Number((Number(resumo.total || 0) + freteAtual).toFixed(2)),
    [resumo.total, freteAtual]
  );

  const freteSelecionado = Number(resultadoPedido?.frete_entrega ?? (retiradaSelecionada ? 0 : simulacaoFrete?.frete ?? 0));
  const distanciaSelecionada = retiradaSelecionada
    ? 0
    : Number(resultadoPedido?.distancia_entrega_km ?? simulacaoFrete?.distancia_km ?? 0);
  const distanciaSelecionadaTexto = distanciaSelecionada > 0 ? `${distanciaSelecionada.toFixed(2)} km` : '-';
  const veiculoSelecionadoResumo = retiradaSelecionada
    ? null
    : (VEICULOS_ENTREGA[resultadoPedido?.veiculo_entrega] || VEICULOS_ENTREGA[simulacaoFrete?.veiculo] || VEICULOS_ENTREGA[veiculoEntrega] || VEICULOS_ENTREGA.moto);
  const atendimentoSelecionadoLabel = retiradaSelecionada
    ? formatarTipoEntrega('retirada')
    : (veiculoSelecionadoResumo?.label || formatarTipoEntrega('entrega'));
  const cepDestinoSelecionado = String(resultadoPedido?.cep_destino_entrega || simulacaoFrete?.cep_destino || formatarCep(cepEntrega) || '-');
  const cepOrigemSelecionado = String(resultadoPedido?.cep_origem_entrega || simulacaoFrete?.cep_origem || CEP_MERCADO);
  const numeroOrigemSelecionado = String(resultadoPedido?.numero_origem_entrega || simulacaoFrete?.numero_origem || NUMERO_MERCADO);
  const totalProdutosPedido = Number(resultadoPedido?.total_produtos ?? resumo.total ?? 0);
  const totalComEntregaPedido = Number(resultadoPedido?.total ?? Number((totalProdutosPedido + freteSelecionado).toFixed(2)));
  const totalReferenciaParcelamento = Number(resultadoPedido?.total ?? totalComFreteAtual ?? 0);
  const parcelamentoCreditoDisponivel = totalReferenciaParcelamento >= PARCELAMENTO_MINIMO_CREDITO;
  const valorMinimoParcelamentoTexto = PARCELAMENTO_MINIMO_CREDITO.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const parcelasCartaoEfetivas = (() => {
    if (formaPagamento === 'debito') {
      return 1;
    }

    if (!parcelamentoCreditoDisponivel) {
      return 1;
    }

    const parcelasSelecionadas = Number.parseInt(parcelasCartao, 10);
    if (!Number.isFinite(parcelasSelecionadas) || parcelasSelecionadas < 1) {
      return 1;
    }

    return Math.min(PARCELAMENTO_MAXIMO_CREDITO, parcelasSelecionadas);
  })();
  const pagamentoCartaoSelecionado = formaPagamento === 'credito' || formaPagamento === 'debito';
  const debitoSelecionado = formaPagamento === 'debito';
  const recaptchaCheckoutEnabled = CHECKOUT_RECAPTCHA_ENABLED && Boolean(RECAPTCHA_SITE_KEY);
  const exibirRecaptchaCheckout = recaptchaCheckoutEnabled
    && autenticado === true
    && (etapaAtual === ETAPAS.PAGAMENTO || etapaAtual === ETAPAS.PIX);
  const tituloFormaPagamento = formaPagamento === 'pix'
    ? 'PIX'
    : formaPagamento === 'debito'
      ? 'Cartão de Débito'
      : 'Cartão de Crédito';
  const sessao3DSValida = Boolean(sessao3DS)
    && Number(sessao3DSGeradaEm) > 0
    && (Date.now() - Number(sessao3DSGeradaEm)) < SESSAO_3DS_TTL_MS;
  const status3DSLabel = STATUS_3DS_LABELS[status3DS] || STATUS_3DS_LABELS.idle;
  const status3DSTone = ['concluida', 'pagamento_aprovado'].includes(status3DS)
    ? 'is-success'
    : ['nao_suportado', 'trocar_metodo', 'erro'].includes(status3DS)
      ? 'is-warning'
      : ['iniciando', 'aguardando_validacao', 'desafio', 'processando_pagamento'].includes(status3DS)
        ? 'is-loading'
        : '';
  const cepEntregaNormalizado = normalizarCep(cepEntrega);
  const cepEntregaValido = cepEntregaNormalizado.length === 8;
  const cepEntregaIncompleto = cepEntregaNormalizado.length > 0 && cepEntregaNormalizado.length < 8;
  const freteCalculado = retiradaSelecionada ? true : Boolean(simulacaoFrete);
  const semOpcaoEntregaDisponivel = retiradaSelecionada
    ? false
    : (!simulandoFrete && !simulacaoFrete && erroEntregaEhCobertura(erroEntrega));
  const podeAvancarParaPagamento = retiradaSelecionada
    ? (itens.length > 0 && !simulandoFrete)
    : (itens.length > 0 && freteCalculado && !simulandoFrete && !semOpcaoEntregaDisponivel);
  const veiculoSelecionadoEntrega = VEICULOS_ENTREGA[veiculoEntrega] || VEICULOS_ENTREGA.moto;
  const veiculoRecomendado = useMemo(() => {
    const distancia = Number(simulacaoFrete?.distancia_km || 0);
    if (distancia > 0 && distancia <= LIMITE_BIKE_KM) {
      return 'bike';
    }

    if (Number(resumo.itens || 0) >= 8 || Number(resumo.total || 0) >= 220) {
      return 'carro';
    }

    return 'moto';
  }, [resumo.itens, resumo.total, simulacaoFrete?.distancia_km]);

  // Consolida feedback da simulação para manter mensagens consistentes na UX da entrega.
  const mensagemFrete = useMemo(() => {
    if (retiradaSelecionada) {
      return {
        tone: 'success',
        text: Number(economiaFreteRetirada || 0) > 0
          ? `Retirada na loja selecionada. Economia estimada de frete: ${formatarMoeda(economiaFreteRetirada)}.`
          : 'Retirada na loja selecionada. Sem cobranca de frete.'
      };
    }

    if (simulandoFrete) {
      return { tone: 'loading', text: 'Calculando frete com base no CEP informado...' };
    }

    if (erroEntrega) {
      if (erroEntregaEhCobertura(erroEntrega)) {
        return { tone: 'warning', text: erroEntrega };
      }
      return { tone: 'error', text: erroEntrega };
    }

    if (simulacaoFrete) {
      const distancia = Number(simulacaoFrete.distancia_km || 0).toFixed(2);
      return {
        tone: 'success',
        text: `Frete calculado com sucesso: ${formatarMoeda(freteAtual)} para ${distancia} km.`
      };
    }

    return {
      tone: 'neutral',
      text: 'Digite um CEP válido e escolha o tipo de entrega para calcular o frete.'
    };
  }, [economiaFreteRetirada, erroEntrega, freteAtual, retiradaSelecionada, simulacaoFrete, simulandoFrete]);

  const consultarEnderecoCepEntrega = useCallback(async (cep, { mostrarErro = true } = {}) => {
    const cepNormalizado = normalizarCep(cep);

    if (cepNormalizado.length !== 8) {
      setBuscandoEnderecoCepEntrega(false);
      setEnderecoCepEntrega(null);
      setCepEnderecoConsultado('');
      if (mostrarErro && cepNormalizado.length > 0) {
        setErroEnderecoCepEntrega('Informe um CEP válido com 8 dígitos.');
      } else {
        setErroEnderecoCepEntrega('');
      }
      return null;
    }

    if (cepEnderecoConsultado === cepNormalizado && enderecoCepEntrega) {
      return enderecoCepEntrega;
    }

    // Evita que uma resposta antiga sobrescreva o endereço de um CEP mais novo.
    const requestId = ++buscaEnderecoRef.current;
    setBuscandoEnderecoCepEntrega(true);
    setErroEnderecoCepEntrega('');

    try {
      const endereco = await buscarEnderecoViaCep(cepNormalizado);

      if (requestId !== buscaEnderecoRef.current) {
        return null;
      }

      setEnderecoCepEntrega(endereco);
      setCepEnderecoConsultado(cepNormalizado);
      return endereco;
    } catch (error) {
      if (requestId !== buscaEnderecoRef.current) {
        return null;
      }

      setEnderecoCepEntrega(null);
      setCepEnderecoConsultado('');

      if (mostrarErro) {
        const mensagem = String(error?.message || '').trim();
        if (mensagem === 'CEP não encontrado') {
          setErroEnderecoCepEntrega('Não encontramos endereço para este CEP.');
        } else if (mensagem === 'CEP inválido') {
          setErroEnderecoCepEntrega('Informe um CEP válido com 8 dígitos.');
        } else {
          setErroEnderecoCepEntrega(mensagem || 'Não foi possível consultar o endereço deste CEP.');
        }
      }

      return null;
    } finally {
      if (requestId === buscaEnderecoRef.current) {
        setBuscandoEnderecoCepEntrega(false);
      }
    }
  }, [cepEnderecoConsultado, enderecoCepEntrega]);

  useEffect(() => {
    const cepNormalizado = cepEntregaNormalizado;

    if (!cepNormalizado) {
      setEnderecoCepEntrega(null);
      setErroEnderecoCepEntrega('');
      setBuscandoEnderecoCepEntrega(false);
      setCepEnderecoConsultado('');
      return;
    }

    if (cepNormalizado.length !== 8) {
      setEnderecoCepEntrega(null);
      setErroEnderecoCepEntrega('');
      setBuscandoEnderecoCepEntrega(false);
      setCepEnderecoConsultado('');
      return;
    }

    const timer = setTimeout(() => {
      // Busca automática do endereço assim que o CEP fica completo.
      void consultarEnderecoCepEntrega(cepNormalizado, { mostrarErro: true });
    }, 260);

    return () => clearTimeout(timer);
  }, [cepEntregaNormalizado, consultarEnderecoCepEntrega]);

  useEffect(() => {
    if (formaPagamento !== 'credito') {
      return;
    }

    if (!parcelamentoCreditoDisponivel && parcelasCartao !== '1') {
      setParcelasCartao('1');
      return;
    }

    const parcelasSelecionadas = Number.parseInt(parcelasCartao, 10);
    if (Number.isFinite(parcelasSelecionadas) && parcelasSelecionadas > PARCELAMENTO_MAXIMO_CREDITO) {
      setParcelasCartao(String(PARCELAMENTO_MAXIMO_CREDITO));
    }
  }, [formaPagamento, parcelamentoCreditoDisponivel, parcelasCartao]);

  useEffect(() => {
    let ativo = true;
    setVerificandoSessao(true);

    getMe()
      .then((data) => {
        if (ativo) {
          setAutenticado(true);
          const usuario = data?.usuario || null;
          setDadosUsuarioCheckout(usuario);

          const nomeUsuario = String(usuario?.nome || '').trim();
          if (nomeUsuario) {
            setNomeTitularCartao((atual) => {
              const atualNormalizado = String(atual || '').trim();
              return atualNormalizado || nomeUsuario;
            });
          }
        }
      })
      .catch((error) => {
        if (!ativo) {
          return;
        }

        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
        } else {
          setAutenticado(false);
          setErro(error.message || 'Não foi possível validar sua sessão.');
        }
      })
      .finally(() => {
        if (ativo) {
          setVerificandoSessao(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!resultadoPedido?.pedido_id || autenticado !== true) {
      return;
    }

    let ativo = true;

    async function atualizarStatus() {
      try {
        const data = await getPedidos();
        const pedido = (data.pedidos || []).find((item) => Number(item.id) === Number(resultadoPedido.pedido_id));
        if (ativo && pedido?.status) {
          const novoStatus = String(pedido.status);
          setStatusPedidoAtual(novoStatus);
          if (novoStatus === 'pago' || novoStatus === 'entregue') {
            setPagamentoConfirmado(true);
          }
        }
      } catch (error) {
        if (isAuthErrorMessage(error.message)) {
          setAutenticado(false);
        }
      }
    }

    atualizarStatus();
    const interval = setInterval(atualizarStatus, 15000);

    return () => {
      ativo = false;
      clearInterval(interval);
    };
  }, [resultadoPedido?.pedido_id, autenticado]);

  async function executarSimulacaoFrete({ mostrarErro = true } = {}) {
    if (retiradaSelecionada) {
      setSimulacaoFrete(null);
      setErroEntrega('');
      return null;
    }

    const cepNormalizado = normalizarCep(cepEntrega);
    if (cepNormalizado.length !== 8) {
      const mensagem = 'Informe um CEP válido com 8 dígitos.';
      setSimulacaoFrete(null);
      if (mostrarErro) {
        setErroEntrega(mensagem);
      }
      return null;
    }

    if (!enderecoCepEntrega || cepEnderecoConsultado !== cepNormalizado) {
      void consultarEnderecoCepEntrega(cepNormalizado, { mostrarErro: false });
    }

    setErroEntrega('');
    setSimulandoFrete(true);

    try {
      const data = await simularFretePorCep({
        cep: cepNormalizado,
        veiculo: veiculoEntrega
      });
      setSimulacaoFrete(data);
      setUltimoFreteEntrega(Number(data?.frete || 0));
      return data;
    } catch (error) {
      setSimulacaoFrete(null);
      if (mostrarErro) {
        setErroEntrega(error.message || 'Não foi possível calcular o frete pelo CEP.');
      }
      return null;
    } finally {
      setSimulandoFrete(false);
    }
  }

  function limparResultadoAutenticacao3DS() {
    setStatus3DS('idle');
    setResultado3DS(null);
    setIdAutenticacao3DS('');
  }

  function limparTokenCartaoGerado() {
    setTokenCartao('');
    setResultadoCartao(null);
    limparResultadoAutenticacao3DS();
  }

  function resetRecaptchaCheckout() {
    setRecaptchaCheckoutToken('');
    setRecaptchaCheckoutErroCarregamento('');

    if (recaptchaCheckoutRef.current && typeof recaptchaCheckoutRef.current.reset === 'function') {
      recaptchaCheckoutRef.current.reset();
    }
  }

  const registrarEventoHomologacao3DS = useCallback((evento, detalhes = {}) => {
    const registro = {
      timestamp: new Date().toISOString(),
      evento: String(evento || '').trim() || 'evento_desconhecido',
      detalhes: (detalhes && typeof detalhes === 'object' && !Array.isArray(detalhes))
        ? detalhes
        : {}
    };

    setEventosHomologacao3DS((atual) => {
      const proximo = [...atual, registro];
      if (proximo.length <= HOMOLOGACAO_3DS_MAX_EVENTOS) {
        return proximo;
      }

      return proximo.slice(proximo.length - HOMOLOGACAO_3DS_MAX_EVENTOS);
    });

    if (IS_DEVELOPMENT) {
      console.info('[debit_3ds_auth.homologacao]', registro);
    }
  }, []);

  function montarPacoteEvidenciaHomologacao3DS() {
    return {
      generated_at: new Date().toISOString(),
      flow: 'debit_3ds_auth',
      pedido_id: Number.parseInt(String(resultadoPedido?.pedido_id || ''), 10) || null,
      reference_id: String(
        resultadoCartao?.reference_id
          || (resultadoPedido?.pedido_id ? `pedido_${resultadoPedido.pedido_id}` : '')
      ).trim() || null,
      payment_summary: resultadoCartao
        ? montarResumoRespostaPagBankHomologacao({
          responsePayload: resultadoCartao,
          pedidoId: resultadoPedido?.pedido_id
        })
        : null,
      events: eventosHomologacao3DS
    };
  }

  function obterRecaptchaCheckoutTokenObrigatorio() {
    if (!recaptchaCheckoutEnabled) {
      return '';
    }

    const token = String(recaptchaCheckoutToken || '').trim();
    if (token) {
      return token;
    }

    throw new Error(
      recaptchaCheckoutErroCarregamento
      || 'Confirme o reCAPTCHA de segurança antes de continuar.'
    );
  }

  function erroIndicaSessao3DSExpirada(error) {
    const detail = error?.detail || {};
    const statusCode = Number(detail?.httpStatus || error?.status || 0);
    const mensagem = String(detail?.message || error?.message || '').toLowerCase();

    if (statusCode === 401 || statusCode === 403) {
      return true;
    }

    return mensagem.includes('session')
      && (mensagem.includes('expir') || mensagem.includes('invalid') || mensagem.includes('unauthorized'));
  }

  async function obterSessao3DSComRenovacao({ forceRefresh = false, pedidoId } = {}) {
    if (!forceRefresh && sessao3DSValida) {
      registrarEventoHomologacao3DS('sessao_3ds_cache', {
        endpoint: '/api/pagbank/3ds/session',
        reference_id: pedidoId ? `pedido_${pedidoId}` : null,
        env: sessao3DSEnv,
        session_masked: mascararValorHomologacao(sessao3DS, { prefixo: 8, sufixo: 4 }),
        reused: true
      });

      return {
        session: sessao3DS,
        env: sessao3DSEnv
      };
    }

    const referencia = pedidoId ? `pedido_${pedidoId}` : '';
    const data = await criarSessao3DSPagBank({ referenceId: referencia });
    const session = String(data?.session || '').trim();
    const env = String(data?.env || 'SANDBOX').trim().toUpperCase() || 'SANDBOX';

    if (!session) {
      throw new Error('Nao foi possivel iniciar a sessao de autenticacao 3DS.');
    }

    setSessao3DS(session);
    setSessao3DSEnv(env);
    setSessao3DSGeradaEm(Date.now());

    registrarEventoHomologacao3DS('geracao_sessao_3ds', {
      endpoint: '/api/pagbank/3ds/session',
      reference_id: referencia || null,
      force_refresh: Boolean(forceRefresh),
      env,
      session_masked: mascararValorHomologacao(session, { prefixo: 8, sufixo: 4 }),
      expires_in_seconds: Number.parseInt(String(data?.expires_in_seconds || ''), 10) || null,
      trace_id_masked: mascararTraceHomologacao(data?.trace_id || data?.traceId) || null
    });

    return {
      session,
      env
    };
  }

  function montarRequestAutenticacao3DS({ documentoDigits } = {}) {
    const numeroCartaoLimpo = normalizarNumeroCartao(numeroCartao);
    const mes = formatarMesCartao(mesExpiracaoCartao).padStart(2, '0');
    const ano = formatarAnoCartao(anoExpiracaoCartao);
    const documentoFiscal3DS = normalizarDocumentoFiscal(documentoDigits);
    const nomeHolder = normalizarNomeCompletoPara3DS(
      nomeTitularCartao || dadosUsuarioCheckout?.nome,
      'Cliente Teste'
    );
    const nomeCliente = normalizarNomeCompletoPara3DS(
      dadosUsuarioCheckout?.nome || nomeHolder,
      'Cliente Teste'
    );
    const emailCliente = String(dadosUsuarioCheckout?.email || 'cliente@example.com').trim() || 'cliente@example.com';
    const telefoneCliente = normalizarTelefonePara3DS(dadosUsuarioCheckout?.telefone) || {
      country: '55',
      area: '11',
      number: '999999999',
      type: 'MOBILE'
    };
    const valorCentavos = Math.max(1, Math.round(Number(resultadoPedido?.total || totalComEntregaPedido || 0) * 100));
    const endereco3DS = construirEndereco3DS({
      endereco: enderecoCepEntrega,
      cepFallback: cepEntrega
    });
    const customerPayload = {
      name: nomeCliente,
      email: emailCliente,
      phones: [telefoneCliente]
    };

    if (validarDocumentoFiscalPagBank3DS(documentoFiscal3DS)) {
      customerPayload.taxId = documentoFiscal3DS;
    }

    return {
      data: {
        customer: customerPayload,
        paymentMethod: {
          type: 'DEBIT_CARD',
          installments: 1,
          card: {
            number: numeroCartaoLimpo,
            expMonth: mes,
            expYear: ano,
            holder: {
              name: nomeHolder
            }
          }
        },
        amount: {
          value: valorCentavos,
          currency: 'BRL'
        },
        billingAddress: endereco3DS,
        shippingAddress: endereco3DS,
        dataOnly: false
      },
      beforeChallenge: ({ open, brand, issuer } = {}) => {
        setStatus3DS('desafio');

        if (IS_DEVELOPMENT) {
          console.info('[debit_3ds_auth.before_challenge]', {
            brand,
            issuer
          });
        }

        if (typeof open === 'function') {
          open();
        }
      }
    };
  }

  async function executarAutenticacao3DSDebito({ pedidoId, documentoDigits } = {}) {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const forceRefresh = tentativa > 0;

      try {
        setStatus3DS('iniciando');
        const sessaoAtual = await obterSessao3DSComRenovacao({
          forceRefresh,
          pedidoId
        });

        await configurarSessao3DSPagBank({
          session: sessaoAtual.session,
          env: sessaoAtual.env
        });

        setStatus3DS('aguardando_validacao');
        const request3DS = montarRequestAutenticacao3DS({ documentoDigits });
        registrarEventoHomologacao3DS('request_authenticate3ds', {
          endpoint: 'https://sandbox.sdk.pagseguro.com/checkout-sdk/3ds/authentications',
          amount: {
            value: Number(request3DS?.data?.amount?.value) || null,
            currency: String(request3DS?.data?.amount?.currency || '').trim() || null
          },
          customer: {
            email_masked: mascararValorHomologacao(request3DS?.data?.customer?.email, { prefixo: 3, sufixo: 8 }) || null,
            tax_id_masked: mascararDocumentoHomologacao(request3DS?.data?.customer?.taxId) || null,
            phone_present: Array.isArray(request3DS?.data?.customer?.phones) && request3DS.data.customer.phones.length > 0
          },
          card: {
            number_masked: mascararValorHomologacao(request3DS?.data?.paymentMethod?.card?.number, { prefixo: 6, sufixo: 4 }) || null,
            exp_month: String(request3DS?.data?.paymentMethod?.card?.expMonth || '').trim() || null,
            exp_year: String(request3DS?.data?.paymentMethod?.card?.expYear || '').trim() || null,
            holder_present: Boolean(String(request3DS?.data?.paymentMethod?.card?.holder?.name || '').trim())
          },
          shipping_address_present: Boolean(request3DS?.data?.shippingAddress),
          billing_address_present: Boolean(request3DS?.data?.billingAddress)
        });
        const resultado = await autenticar3DSPagBank(request3DS);
        const status = String(resultado?.status || '').trim().toUpperCase();
        const authId = String(resultado?.id || '').trim();
        const traceId = String(
          resultado?.traceId
            || resultado?.trace_id
            || resultado?.detail?.traceId
            || resultado?.detail?.trace_id
            || ''
        ).trim() || null;

        if (IS_DEVELOPMENT) {
          console.info('[debit_3ds_auth.result]', {
            status,
            authId: authId || null,
            traceId
          });
        }

        setResultado3DS({
          status,
          id: authId || null,
          trace_id: traceId
        });

        registrarEventoHomologacao3DS('resultado_authenticate3ds', {
          status,
          authentication_id_masked: authId
            ? mascararValorHomologacao(authId, { prefixo: 6, sufixo: 4 })
            : null,
          trace_id_masked: traceId ? mascararTraceHomologacao(traceId) : null
        });

        if (status === 'AUTH_FLOW_COMPLETED') {
          if (!authId) {
            setStatus3DS('erro');
            throw new Error('A autenticacao 3DS foi concluida sem id valido. Tente novamente.');
          }

          setIdAutenticacao3DS(authId);
          setStatus3DS('concluida');

          return {
            status,
            authenticationMethod: {
              type: 'THREEDS',
              id: authId
            },
            traceId
          };
        }

        if (status === 'AUTH_NOT_SUPPORTED') {
          setStatus3DS('nao_suportado');
          throw new Error('Seu cartao de debito nao e elegivel para autenticacao 3DS. Escolha outro meio de pagamento.');
        }

        if (status === 'CHANGE_PAYMENT_METHOD') {
          setStatus3DS('trocar_metodo');
          throw new Error('A autenticacao 3DS foi negada. Escolha outro meio de pagamento.');
        }

        if (status === 'REQUIRE_CHALLENGE') {
          setStatus3DS('desafio');
          throw new Error('Conclua o desafio 3DS para continuar o pagamento no debito.');
        }

        setStatus3DS('erro');
        throw new Error('Nao foi possivel concluir a autenticacao 3DS. Tente novamente.');
      } catch (error) {
        const detail = (error?.detail && typeof error.detail === 'object' && !Array.isArray(error.detail))
          ? error.detail
          : {};
        const erroDetalhado = String(detail?.message || detail?.error_description || detail?.error || '').trim();
        const erroCodigo = String(detail?.code || detail?.error_code || '').trim();
        const erroHttpStatus = Number(detail?.httpStatus || detail?.status || error?.status || 0) || null;
        const erroMensagens = sanitizarErrorMessages3DS(detail?.errorMessages);

        registrarEventoHomologacao3DS('erro_authenticate3ds', {
          message: String(error?.message || 'Falha ao autenticar 3DS').trim(),
          sdk_http_status: erroHttpStatus,
          sdk_code: erroCodigo || null,
          sdk_message: erroDetalhado || null,
          sdk_error_messages: erroMensagens.length ? erroMensagens : null,
          trace_id_masked: mascararTraceHomologacao(
            error?.traceId
              || error?.trace_id
              || error?.detail?.traceId
              || error?.detail?.trace_id
          ) || null
        });

        if (IS_DEVELOPMENT) {
          console.error('[debit_3ds_auth.error]', {
            message: error?.message,
            httpStatus: erroHttpStatus,
            code: erroCodigo || null,
            detailMessage: erroDetalhado || null,
            errorMessages: erroMensagens,
            detail: error?.detail || null
          });
        }

        if (tentativa === 0 && erroIndicaSessao3DSExpirada(error)) {
          setSessao3DS('');
          setSessao3DSGeradaEm(0);
          continue;
        }

        throw error;
      }
    }

    setStatus3DS('erro');
    throw new Error('Sessao 3DS expirada. Gere uma nova autenticacao e tente novamente.');
  }

  async function carregarChavePublicaPagBank() {
    if (pagBankPublicKey) {
      return pagBankPublicKey;
    }

    setBuscandoChavePublica(true);
    try {
      const data = await getPagBankPublicKey();
      const chave = String(data?.public_key || '').trim();
      if (!chave) {
        throw new Error('Não foi possível iniciar o pagamento com cartão no momento.');
      }

      setPagBankPublicKey(chave);
      return chave;
    } finally {
      setBuscandoChavePublica(false);
    }
  }

  async function handleCriptografarCartao() {
    setErro('');

    if (!pagamentoCartaoSelecionado) {
      return '';
    }

    const holder = String(nomeTitularCartao || '').trim();
    const number = normalizarNumeroCartao(numeroCartao);
    const expMonth = formatarMesCartao(mesExpiracaoCartao);
    const expYear = formatarAnoCartao(anoExpiracaoCartao);
    const securityCode = formatarCvvCartao(cvvCartao);

    if (holder.length < 3) {
      throw new Error('Informe o nome completo do titular do cartão.');
    }

    if (number.length < 13) {
      throw new Error('Número do cartão inválido.');
    }

    const mes = Number.parseInt(expMonth, 10);
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      throw new Error('Mês de expiração inválido.');
    }

    if (expYear.length !== 4) {
      throw new Error('Ano de expiração inválido.');
    }

    if (![3, 4].includes(securityCode.length)) {
      throw new Error('CVV inválido.');
    }

    setCriptografandoCartao(true);
    try {
      const publicKey = await carregarChavePublicaPagBank();
      const encryptedCard = await criptografarCartaoPagBank({
        publicKey,
        holder,
        number,
        expMonth,
        expYear,
        securityCode
      });

      setTokenCartao(encryptedCard);
      return encryptedCard;
    } finally {
      setCriptografandoCartao(false);
    }
  }

  async function handleCriarPedido() {
    setResultadoPix(null);
    setResultadoCartao(null);
    limparResultadoAutenticacao3DS();
    setSessao3DS('');
    setSessao3DSEnv('SANDBOX');
    setSessao3DSGeradaEm(0);
    setResultadoPedido(null);
    setResumoPedidoSnapshot(null);
    setItensPedidoSnapshot([]);
    setQrCodePixDataUrl('');
    setFeedbackCopiaPix('');
    setErro('');

    if (autenticado !== true) {
      setAutenticado(false);
      setErro('Faça login para concluir o pedido.');
      return;
    }

    if (itensPedido.length === 0) {
      setErro('Adicione produtos ao carrinho para continuar.');
      return;
    }

    const cepNormalizado = normalizarCep(cepEntrega);
    let freteSimulado = null;

    if (!retiradaSelecionada) {
      if (cepNormalizado.length !== 8) {
        setErroEntrega('Informe um CEP válido com 8 dígitos para calcular a entrega.');
        setEtapaAtual(ETAPAS.ENTREGA);
        return;
      }

      freteSimulado = simulacaoFrete;
      const cepSimulacaoAtual = normalizarCep(simulacaoFrete?.cep_destino);
      const veiculoSimulacaoAtual = String(simulacaoFrete?.veiculo || '').toLowerCase();
      const precisaNovaSimulacao = !freteSimulado || cepSimulacaoAtual !== cepNormalizado || veiculoSimulacaoAtual !== veiculoEntrega;

      if (precisaNovaSimulacao) {
        freteSimulado = await executarSimulacaoFrete();
        if (!freteSimulado) {
          setEtapaAtual(ETAPAS.ENTREGA);
          return;
        }
      }
    }

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro(`Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento via ${formaPagamento === 'pix' ? 'PIX' : 'cartão'}.`);
      setEtapaAtual(ETAPAS.PAGAMENTO);
      return;
    }

    if (formaPagamento === 'debito' && !validarDocumentoFiscalPagBank3DS(documentoDigits)) {
      setErro('Para débito com autenticação 3DS, informe um CPF ou CNPJ válido.');
      setEtapaAtual(ETAPAS.PAGAMENTO);
      return;
    }

    if (pagamentoCartaoSelecionado) {
      try {
        await carregarChavePublicaPagBank();
      } catch (error) {
        setErro(error.message || 'Não foi possível preparar o pagamento com cartão.');
        setEtapaAtual(ETAPAS.PAGAMENTO);
        return;
      }
    }

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para continuar.');
      return;
    }

    setCarregando(true);
    try {
      const entregaPayload = retiradaSelecionada
        ? null
        : {
          veiculo: veiculoEntrega,
          cep_destino: formatarCep(cepNormalizado),
          frete_estimado: Number(freteSimulado?.frete || 0),
          distancia_km: Number(freteSimulado?.distancia_km || 0),
          fator_reparo: VEICULOS_ENTREGA[veiculoEntrega]?.fatorReparo || 1
        };

      const data = await criarPedido({
        itens: itensPedido,
        formaPagamento,
        tipoEntrega,
        taxId: documentoDigits,
        recaptchaToken: recaptchaTokenAcao,
        entrega: entregaPayload
      });

      setResultadoPedido(data);
      const itensSnapshot = itensPedido.reduce((accumulator, item) => {
        return accumulator + Number(item.quantidade || 0);
      }, 0);
      setResumoPedidoSnapshot({
        itens: itensSnapshot,
        subtotal: Number(data?.total_produtos ?? resumo.total ?? 0),
        frete: Number(data?.frete_entrega ?? freteSimulado?.frete ?? 0)
      });
      setItensPedidoSnapshot(
        itensPedido.map((item) => ({
          produto_id: item.produto_id,
          nome: item.nome,
          preco: Number(item.preco || 0),
          quantidade: Number(item.quantidade || 1)
        }))
      );
      const formaRetornada = String(data?.forma_pagamento || formaPagamento || '').toLowerCase();
      if (formaRetornada === 'debito') {
        setFormaPagamento('debito');
      } else if (['cartao', 'credito'].includes(formaRetornada)) {
        setFormaPagamento('credito');
      } else {
        setFormaPagamento('pix');
      }
      setStatusPedidoAtual('pendente');
      clearCart();
      setEtapaAtual(ETAPAS.PIX);

      if (formaPagamento === 'pix' && (data?.pix_codigo || data?.pix_qrcode)) {
        setResultadoPix({
          status: data.pix_erro ? 'CANCELED' : 'WAITING',
          status_interno: data?.pix_erro ? 'cancelado' : 'pendente',
          qr_data: data?.pix_codigo || '',
          qr_code_base64: data?.qr_code_base64 || null,
          pix_codigo: data?.pix_codigo || '',
          pix_qrcode: data?.pix_qrcode || ''
        });
      }
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  async function handleIrParaPagamento() {
    if (resultadoPedido?.pedido_id) {
      setEtapaAtual(ETAPAS.PIX);
      return;
    }
    await handleCriarPedido();
  }

  async function handleContinuarPagamento() {
    setDocumentoTocado(true);

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    if (!(documentoDigits.length === 11 || documentoDigits.length === 14)) {
      setErro(`Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento via ${formaPagamento === 'pix' ? 'PIX' : 'cartão'}.`);
      return;
    }

    setErro('');
    await handleIrParaPagamento();
  }

  async function handleGerarPix(pedidoId) {
    setResultadoPix(null);
    setFeedbackCopiaPix('');
    setErro('');

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para gerar o PIX.');
      return;
    }

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para gerar o PIX.');
      return;
    }

    setCarregando(true);
    try {
      const data = await gerarPix(pedidoId, documentoDigits, recaptchaTokenAcao);
      setResultadoPix({
        ...data,
        status: String(data?.status || 'WAITING').toUpperCase(),
        qr_data: String(data?.qr_data || data?.pix_codigo || '').trim(),
        pix_codigo: String(data?.pix_codigo || data?.qr_data || '').trim(),
        pix_qrcode: String(data?.pix_qrcode || '').trim()
      });
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message);
    } finally {
      setCarregando(false);
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  async function handleVerificarPagamentoPix() {
    if (!resultadoPedido?.pedido_id) {
      return;
    }

    setErro('');
    setVerificandoStatusPix(true);

    try {
      const data = await getPedidos();
      const pedidoAtual = (data?.pedidos || []).find((item) => Number(item.id) === Number(resultadoPedido.pedido_id));
      if (!pedidoAtual) {
        throw new Error('Não foi possível localizar o pedido para verificar o pagamento.');
      }

      const statusInterno = String(pedidoAtual.status || '').toLowerCase();
      setStatusPedidoAtual(statusInterno);

      const aprovado = statusInterno === 'pago' || statusInterno === 'entregue';
      setPagamentoConfirmado(aprovado);

      setResultadoPix((atual) => {
        if (!atual) {
          return atual;
        }

        return {
          ...atual,
          status: aprovado
            ? 'PAID'
            : statusInterno === 'cancelado'
              ? 'CANCELED'
              : String(atual.status || 'WAITING').toUpperCase(),
          status_interno: statusInterno
        };
      });
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }
      setErro(error.message || 'Não foi possível atualizar o status do pagamento PIX.');
    } finally {
      setVerificandoStatusPix(false);
    }
  }

  async function handleCopiarCodigoPix() {
    if (!codigoPixAtual) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(codigoPixAtual);
      } else {
        const campoTemporario = document.createElement('textarea');
        campoTemporario.value = codigoPixAtual;
        campoTemporario.setAttribute('readonly', '');
        campoTemporario.style.position = 'absolute';
        campoTemporario.style.left = '-9999px';
        document.body.appendChild(campoTemporario);
        campoTemporario.select();
        document.execCommand('copy');
        document.body.removeChild(campoTemporario);
      }

      setFeedbackCopiaPix('Código copiado com sucesso.');
    } catch {
      setFeedbackCopiaPix('Não foi possível copiar automaticamente. Selecione e copie manualmente.');
    }
  }

  async function handleCopiarEvidenciaHomologacao3DS() {
    if (!eventosHomologacao3DS.length) {
      return;
    }

    const conteudo = JSON.stringify(montarPacoteEvidenciaHomologacao3DS(), null, 2);

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(conteudo);
      } else {
        const campoTemporario = document.createElement('textarea');
        campoTemporario.value = conteudo;
        campoTemporario.setAttribute('readonly', '');
        campoTemporario.style.position = 'absolute';
        campoTemporario.style.left = '-9999px';
        document.body.appendChild(campoTemporario);
        campoTemporario.select();
        document.execCommand('copy');
        document.body.removeChild(campoTemporario);
      }

      setFeedbackEvidencia3DS('Log sanitizado de homologacao 3DS copiado.');
    } catch {
      setFeedbackEvidencia3DS('Nao foi possivel copiar o log de homologacao automaticamente.');
    }
  }

  function handleBaixarEvidenciaHomologacao3DS() {
    if (!eventosHomologacao3DS.length) {
      return;
    }

    const conteudo = JSON.stringify(montarPacoteEvidenciaHomologacao3DS(), null, 2);
    const pedidoIdArquivo = Number.parseInt(String(resultadoPedido?.pedido_id || ''), 10) || 'sem-pedido';
    const nomeArquivo = `pagbank-hml-debito-3ds-pedido-${pedidoIdArquivo}-${Date.now()}.json`;
    const blob = new Blob([conteudo], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFeedbackEvidencia3DS(`Arquivo de homologacao gerado: ${nomeArquivo}`);
  }

  async function handlePagarCartao(pedidoId) {
    if (pagandoCartaoRef.current || carregando || criptografandoCartao) {
      return;
    }

    setResultadoCartao(null);
    setErro('');

    if (debitoSelecionado) {
      setEventosHomologacao3DS([]);
      setFeedbackEvidencia3DS('');
    }

    const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
    const documentoValido = documentoDigits.length === 11 || documentoDigits.length === 14;
    if (!documentoValido) {
      setErro('Informe CPF (11 dígitos) ou CNPJ (14 dígitos) para pagamento com cartão.');
      return;
    }

    if (debitoSelecionado && !validarDocumentoFiscalPagBank3DS(documentoDigits)) {
      setErro('Para débito com autenticação 3DS, informe um CPF ou CNPJ válido.');
      return;
    }

    let recaptchaTokenAcao = '';
    try {
      recaptchaTokenAcao = obterRecaptchaCheckoutTokenObrigatorio();
    } catch (error) {
      setErro(error.message || 'Confirme o reCAPTCHA de segurança para continuar no cartão.');
      return;
    }

    pagandoCartaoRef.current = true;

    let tokenNormalizado = String(tokenCartao || '').trim();
    if (!tokenNormalizado) {
      try {
        tokenNormalizado = await handleCriptografarCartao();
      } catch (error) {
        setErro(error.message || 'Não foi possível validar os dados do cartão.');
        pagandoCartaoRef.current = false;
        return;
      }
    }

    setCarregando(true);
    try {
      let authenticationMethod = null;
      let threeDSResultPayload = null;

      if (debitoSelecionado) {
        const resultadoAutenticacao = await executarAutenticacao3DSDebito({
          pedidoId,
          documentoDigits
        });

        authenticationMethod = resultadoAutenticacao?.authenticationMethod || null;
        threeDSResultPayload = {
          flow: 'debit_3ds_auth',
          status: resultadoAutenticacao?.status || null,
          id: authenticationMethod?.id || null,
          trace_id: resultadoAutenticacao?.traceId || null
        };
        setStatus3DS('processando_pagamento');
      }

      const payloadPagamentoCartao = {
        pedido_id: pedidoId,
        tax_id: documentoDigits,
        token_cartao: tokenNormalizado,
        parcelas: parcelasCartaoEfetivas,
        tipo_cartao: formaPagamento,
        authentication_method: authenticationMethod,
        three_ds_result: threeDSResultPayload,
        recaptcha_token: recaptchaTokenAcao
      };

      if (debitoSelecionado) {
        registrarEventoHomologacao3DS(
          'request_final_pedido',
          sanitizarRequestPagamentoCartaoHomologacao({ payloadRequest: payloadPagamentoCartao })
        );
      }

      const data = await pagarCartao(pedidoId, {
        taxId: documentoDigits,
        tokenCartao: tokenNormalizado,
        parcelas: parcelasCartaoEfetivas,
        tipoCartao: formaPagamento,
        authenticationMethod,
        threeDSResult: threeDSResultPayload,
        recaptchaToken: recaptchaTokenAcao
      });

      setResultadoCartao(data);

      if (debitoSelecionado) {
        registrarEventoHomologacao3DS(
          'response_final_pagbank',
          montarResumoRespostaPagBankHomologacao({
            responsePayload: data,
            pedidoId
          })
        );
      }

      const statusPagBank = String(data?.status || '').toUpperCase();
      const statusInterno = String(data?.status_interno || '').toLowerCase();
      if (statusPagBank === 'PAID' || statusInterno === 'pago' || statusInterno === 'entregue') {
        setStatusPedidoAtual(statusInterno || 'pago');
        setPagamentoConfirmado(true);

        if (debitoSelecionado) {
          setStatus3DS('pagamento_aprovado');
        }
      }
    } catch (error) {
      if (isAuthErrorMessage(error.message)) {
        setAutenticado(false);
      }

      if (debitoSelecionado) {
        registrarEventoHomologacao3DS('erro_pagamento_backend', {
          endpoint: '/api/pagamentos/cartao',
          message: String(error?.message || 'Falha no processamento do pagamento com cartao.').trim(),
          trace_id_masked: mascararTraceHomologacao(
            error?.traceId
              || error?.trace_id
              || error?.detail?.traceId
              || error?.detail?.trace_id
          ) || null
        });

        setStatus3DS((atual) => (
          ['nao_suportado', 'trocar_metodo', 'pagamento_aprovado'].includes(atual)
            ? atual
            : 'erro'
        ));
      }

      setErro(error.message);
    } finally {
      setCarregando(false);
      pagandoCartaoRef.current = false;
      if (recaptchaCheckoutEnabled) {
        resetRecaptchaCheckout();
      }
    }
  }

  function getIndiceEtapa(etapa) {
    if (etapa === ETAPAS.CARRINHO) return 0;
    if (etapa === ETAPAS.ENTREGA) return 1;
    // PIX permanece dentro da etapa de Pagamento no stepper.
    if (etapa === ETAPAS.PAGAMENTO || etapa === ETAPAS.PIX) return 2;
    return 3;
  }

  const etapaIndex = getIndiceEtapa(etapaAtual);
  const labelStatus = formatarStatusPedido(statusPedidoAtual || resultadoPedido?.status || 'pendente');
  const carrinhoVazio = itens.length === 0;
  const statusCartaoAtual = String(resultadoCartao?.status || '').toUpperCase();
  const statusInternoCartaoAtual = String(resultadoCartao?.status_interno || '').toLowerCase();
  const cartaoRecusado = statusCartaoAtual === 'DECLINED' || statusCartaoAtual === 'CANCELED';
  const cartaoProcessado = Boolean(resultadoCartao) && !cartaoRecusado;
  const cartaoAprovado = statusCartaoAtual === 'PAID' || statusInternoCartaoAtual === 'pago' || statusInternoCartaoAtual === 'entregue';
  const documentoDigits = normalizarDocumentoFiscal(documentoPagador);
  const documentoValidoPagamento = documentoDigits.length === 11 || documentoDigits.length === 14;
  const feedbackEvidencia3DSTone = feedbackEvidencia3DS
    ? (String(feedbackEvidencia3DS).toLowerCase().includes('nao foi possivel')
      || String(feedbackEvidencia3DS).toLowerCase().includes('não foi possível')
      ? 'is-warning'
      : 'is-success')
    : '';
  const documentoObrigatorioNaoPreenchido = documentoTocado && documentoDigits.length === 0;
  const documentoInvalidoPagamento = documentoTocado && documentoDigits.length > 0 && !documentoValidoPagamento;
  const documentoValidoFeedback = documentoTocado && documentoValidoPagamento;
  const recaptchaCheckoutPronto = !recaptchaCheckoutEnabled || Boolean(String(recaptchaCheckoutToken || '').trim());
  const nomeTitularCartaoValido = String(nomeTitularCartao || '').trim().length >= 3;
  const numeroCartaoValido = normalizarNumeroCartao(numeroCartao).length >= 13;
  const mesCartaoNumero = Number.parseInt(formatarMesCartao(mesExpiracaoCartao), 10);
  const mesCartaoValido = Number.isInteger(mesCartaoNumero) && mesCartaoNumero >= 1 && mesCartaoNumero <= 12;
  const anoCartaoNormalizado = formatarAnoCartao(anoExpiracaoCartao);
  const anoCartaoNumero = Number.parseInt(anoCartaoNormalizado, 10);
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const anoCartaoValido = anoCartaoNormalizado.length === 4
    && Number.isInteger(anoCartaoNumero)
    && (anoCartaoNumero > anoAtual || (anoCartaoNumero === anoAtual && mesCartaoValido && mesCartaoNumero >= mesAtual));
  const cvvCartaoValido = [3, 4].includes(formatarCvvCartao(cvvCartao).length);
  const dadosCartaoCompletos = nomeTitularCartaoValido && numeroCartaoValido && mesCartaoValido && anoCartaoValido && cvvCartaoValido;
  const cartaoProntoParaContinuar = !pagamentoCartaoSelecionado || Boolean(tokenCartao) || dadosCartaoCompletos;
  const formaPagamentoAtual = FORMAS_PAGAMENTO_OPCOES[formaPagamento] || FORMAS_PAGAMENTO_OPCOES.pix;
  const ctaFinalPedidoBase = retiradaSelecionada ? 'Reservar para retirada' : 'Finalizar pedido';
  const ctaFinalPedido = growthCheckoutPaymentEnabled && growthCheckoutPaymentConfig.ctaPrefix
    ? growthCheckoutPaymentConfig.ctaPrefix
    : ctaFinalPedidoBase;
  const resumoFretePagamento = resultadoPedido?.pedido_id
    ? freteSelecionado
    : retiradaSelecionada
      ? 0
      : simulacaoFrete
        ? freteAtual
        : null;
  const resumoTotalPagamento = resultadoPedido?.pedido_id
    ? totalComEntregaPedido
    : retiradaSelecionada
      ? Number(resumo.total || 0)
      : simulacaoFrete
        ? totalComFreteAtual
        : Number(resumo.total || 0);
  const resumoItensPagamento = Number(resultadoPedido?.itens_count || resumoPedidoSnapshot?.itens || resumo.itens || 0);
  const pagamentoSemFreteCalculado = !retiradaSelecionada && !resultadoPedido?.pedido_id && !simulacaoFrete;
  const pagamentoSemItens = itens.length === 0 && !resultadoPedido?.pedido_id;
  const bloqueioPagamento = pagamentoSemItens
    || pagamentoSemFreteCalculado
    || carregando
    || simulandoFrete
    || buscandoChavePublica
    || !documentoValidoPagamento
    || !recaptchaCheckoutPronto
    || (pagamentoCartaoSelecionado && !cartaoProntoParaContinuar);
  const mensagemBloqueioPagamento = pagamentoSemItens
    ? 'Seu carrinho está vazio. Adicione produtos para seguir com o pagamento.'
    : pagamentoSemFreteCalculado
      ? 'Frete ainda não calculado. Volte para entrega e calcule o CEP para continuar.'
      : documentoDigits.length === 0
        ? 'Informe CPF/CNPJ para habilitar a continuação.'
        : !documentoValidoPagamento
          ? 'Documento inválido. Use CPF com 11 dígitos ou CNPJ com 14 dígitos.'
          : !recaptchaCheckoutPronto
            ? 'Confirme o reCAPTCHA de seguranca para habilitar a continuacao.'
          : pagamentoCartaoSelecionado && !cartaoProntoParaContinuar
            ? 'Complete os dados do cartão para habilitar a continuação.'
        : '';
  const codigoPixAtual = String(resultadoPix?.qr_data || resultadoPix?.pix_codigo || resultadoPedido?.pix_codigo || '').trim();
  const qrCodeBase64Atual = String(resultadoPix?.qr_code_base64 || '').trim();
  const qrCodeRemotoAtual = String(resultadoPix?.pix_qrcode || resultadoPedido?.pix_qrcode || '').trim();
  const qrCodePixSrc = qrCodeBase64Atual
    ? `data:image/png;base64,${qrCodeBase64Atual}`
    : qrCodeRemotoAtual || qrCodePixDataUrl;
  const statusPixVisual = obterStatusPixVisual({
    status: resultadoPix?.status,
    statusInterno: resultadoPix?.status_interno || statusPedidoAtual || resultadoPedido?.status,
    pagamentoConfirmado
  });
  const pixPagamentoAprovado = statusPixVisual.aprovado;
  const textoBotaoGerarPix = carregando
    ? 'Gerando QR Code PIX...'
    : codigoPixAtual || qrCodePixSrc
      ? 'Atualizar QR Code'
      : 'Gerar QR Code PIX';
  const checklistPagamento = [
    {
      id: 'itens',
      label: 'Itens do pedido prontos',
      ok: !pagamentoSemItens || Boolean(resultadoPedido?.pedido_id)
    },
    {
      id: 'frete',
      label: retiradaSelecionada ? 'Retirada na loja (sem frete)' : 'Frete calculado',
      ok: retiradaSelecionada ? true : !pagamentoSemFreteCalculado
    },
    {
      id: 'documento',
      label: 'CPF/CNPJ válido',
      ok: documentoValidoPagamento
    },
    {
      id: 'recaptcha',
      label: 'Validacao reCAPTCHA concluida',
      ok: recaptchaCheckoutPronto
    },
    pagamentoCartaoSelecionado
      ? {
        id: 'cartao',
        label: tokenCartao ? 'Dados do cartão validados' : 'Dados do cartão preenchidos',
        ok: cartaoProntoParaContinuar
      }
      : null
  ].filter(Boolean);
  const itensResumoPix = Number(resultadoPedido?.itens_count || resumoPedidoSnapshot?.itens || 0);
  const itensResumoPixExibicao = itensResumoPix > 0
    ? itensResumoPix
    : resumoItensPagamento > 0
      ? resumoItensPagamento
      : '—';
  const podeContinuarConfirmacaoPix = pixPagamentoAprovado || pagamentoConfirmado;
  const bloqueioGeracaoPix = carregando || verificandoStatusPix || !resultadoPedido?.pedido_id || !recaptchaCheckoutPronto;
  const bloqueioVerificacaoPix = verificandoStatusPix || carregando || !resultadoPedido?.pedido_id;
  const pixDisponivelParaPagar = Boolean(codigoPixAtual || qrCodePixSrc);
  const itensDistintosCarrinho = itens.length;
  const resumoItensCarrinho = formatarQuantidadeItens(resumo.itens);
  const pendenciasChecklistPagamento = checklistPagamento.filter((item) => !item.ok).length;
  const mensagemProcessamentoCheckout = etapaAtual === ETAPAS.PIX
    ? (formaPagamento === 'pix'
      ? 'Processando informações do PIX. Aguarde para evitar pagamentos duplicados.'
      : `Processando ${tituloFormaPagamento.toLowerCase()}. Aguarde a confirmação do gateway.`)
    : 'Processando as informações do seu pedido com segurança.';
  const pagamentoAprovadoCheckout = pagamentoConfirmado || pixPagamentoAprovado || cartaoAprovado;

  const contextoCheckout = (() => {
    if (etapaAtual === ETAPAS.CARRINHO) {
      if (carrinhoVazio) {
        return {
          tone: 'neutral',
          title: 'Seu carrinho está pronto para começar.',
          description: 'Escolha seus produtos e volte para finalizar com calma.',
          chips: ['Adicione produtos', 'Revise quantidades', 'Siga para entrega']
        };
      }

      return {
        tone: 'info',
        title: 'Revise sua compra antes de seguir.',
        description: `${itensDistintosCarrinho} produtos diferentes, ${resumoItensCarrinho} e total parcial de ${formatarMoeda(resumo.total)}.`,
        chips: ['Confirme subtotal', 'Ajuste quantidades', 'Avance para calcular frete']
      };
    }

    if (etapaAtual === ETAPAS.ENTREGA) {
      if (retiradaSelecionada) {
        return {
          tone: 'success',
          title: 'Retirada na loja selecionada.',
          description: Number(economiaFreteRetirada || 0) > 0
            ? `Voce economiza ${formatarMoeda(economiaFreteRetirada)} de frete com retirada.`
            : 'Sem custo de frete. Agora avance para o pagamento da sua reserva.',
          chips: ['Sem frete', 'Retirada no balcao', 'Pronto para pagamento']
        };
      }

      if (semOpcaoEntregaDisponivel) {
        return {
          tone: 'warning',
          title: 'Ainda não encontramos cobertura para este CEP.',
          description: 'Revise o CEP informado ou tente outro endereço para continuar.',
          chips: ['CEP válido', 'Endereço conferido', 'Escolha de entrega']
        };
      }

      if (freteCalculado) {
        return {
          tone: 'success',
          title: 'Entrega calculada com sucesso.',
          description: `${veiculoSelecionadoEntrega.label} selecionada com frete de ${formatarMoeda(freteAtual)} para ${distanciaSelecionadaTexto}.`,
          chips: ['Frete confirmado', 'Tipo de entrega definido', 'Pronto para pagamento']
        };
      }

      return {
        tone: 'neutral',
        title: 'Defina o CEP e calcule o frete.',
        description: 'Depois de calcular o frete, você já pode seguir para o pagamento.',
        chips: ['CEP de entrega', 'Conferir endereço', 'Selecionar tipo de entrega']
      };
    }

    if (etapaAtual === ETAPAS.PAGAMENTO) {
      if (pendenciasChecklistPagamento > 0) {
        return {
          tone: 'warning',
          title: 'Faltam alguns itens para concluir esta etapa.',
          description: `Há ${pendenciasChecklistPagamento} pendência(s) no checklist antes da confirmação.`,
          chips: ['Documento válido', 'reCAPTCHA ativo', 'Forma de pagamento revisada']
        };
      }

      return {
        tone: 'success',
        title: 'Tudo pronto para avançar com o pagamento.',
        description: `Método selecionado: ${formaPagamentoAtual.title}. Total atual ${formatarMoeda(resumoTotalPagamento)}.`,
        chips: ['Dados conferidos', 'Resumo validado', 'Pronto para finalizar']
      };
    }

    if (etapaAtual === ETAPAS.PIX) {
      if (formaPagamento === 'pix') {
        if (podeContinuarConfirmacaoPix) {
          return {
            tone: 'success',
            title: 'Pagamento PIX confirmado.',
            description: 'Você já pode seguir para a confirmação final do pedido.',
            chips: ['PIX aprovado', 'Pedido identificado', 'Pronto para confirmar']
          };
        }

        return {
          tone: pixDisponivelParaPagar ? 'info' : 'neutral',
          title: pixDisponivelParaPagar ? 'PIX gerado. Falta confirmar o pagamento.' : 'Gere o QR Code para pagar com PIX.',
          description: pixDisponivelParaPagar
            ? 'Depois de pagar no app do banco, clique em verificar para atualizar o status.'
            : 'Você pode pagar escaneando o QR Code ou copiando o código PIX.',
          chips: ['QR Code', 'Código copia e cola', 'Validação de pagamento']
        };
      }

      if (cartaoRecusado) {
        return {
          tone: 'warning',
          title: 'Pagamento no cartão não foi aprovado.',
          description: 'Revise os dados do cartão e tente novamente para continuar o pedido.',
          chips: ['Conferir dados', 'Tentar novamente', 'Acompanhar status']
        };
      }

      return {
        tone: cartaoAprovado ? 'success' : 'info',
        title: cartaoAprovado ? 'Pagamento no cartão aprovado.' : 'Aguardando conclusão do pagamento no cartão.',
        description: cartaoAprovado
          ? 'Agora você já pode seguir para a confirmação final do pedido.'
          : 'Conclua o pagamento para liberar a etapa de confirmação.',
        chips: ['Autorização do cartão', 'Status do pedido', 'Confirmação final']
      };
    }

    return {
      tone: pagamentoConfirmado ? 'success' : 'info',
      title: pagamentoConfirmado ? 'Pedido confirmado com sucesso.' : 'Pedido em acompanhamento.',
      description: pagamentoConfirmado
        ? 'Seguimos para preparação e envio assim que o pagamento é confirmado.'
        : 'Acompanhe a atualização automática enquanto o pagamento é processado.',
      chips: ['Status em tempo real', 'Suporte disponível', 'Acompanhamento do pedido']
    };
  })();

  const exibirBarraMobileCheckout = etapaAtual !== ETAPAS.STATUS;
  const mobileActionBarConfig = (() => {
    if (etapaAtual === ETAPAS.CARRINHO) {
      return {
        stepLabel: 'Etapa 1 de 4',
        totalLabel: `Total parcial: ${formatarMoeda(resumo.total)}`,
        caption: carrinhoVazio ? 'Adicione itens para avançar.' : `${resumoItensCarrinho} no carrinho`,
        primaryLabel: 'Ir para entrega',
        onPrimaryClick: () => setEtapaAtual(ETAPAS.ENTREGA),
        primaryDisabled: carrinhoVazio,
        secondaryLabel: 'Continuar comprando',
        secondaryTo: '/produtos'
      };
    }

    if (etapaAtual === ETAPAS.ENTREGA) {
      return {
        stepLabel: 'Etapa 2 de 4',
        totalLabel: retiradaSelecionada
          ? `Total sem frete: ${formatarMoeda(resumo.total)}`
          : simulacaoFrete
            ? `Total com frete: ${formatarMoeda(totalComFreteAtual)}`
            : `Subtotal atual: ${formatarMoeda(resumo.total)}`,
        caption: retiradaSelecionada
          ? 'Retirada na loja selecionada. Siga para pagamento.'
          : simulacaoFrete
            ? 'Frete calculado e pronto para pagamento.'
            : 'Calcule o frete para continuar.',
        primaryLabel: 'Ir para pagamento',
        onPrimaryClick: () => setEtapaAtual(ETAPAS.PAGAMENTO),
        primaryDisabled: !podeAvancarParaPagamento,
        secondaryLabel: 'Voltar ao carrinho',
        onSecondaryClick: () => setEtapaAtual(ETAPAS.CARRINHO)
      };
    }

    if (etapaAtual === ETAPAS.PAGAMENTO) {
      return {
        stepLabel: 'Etapa 3 de 4',
        totalLabel: `Total do pedido: ${formatarMoeda(resumoTotalPagamento)}`,
        caption: `Forma atual: ${formaPagamentoAtual.title}`,
        primaryLabel: carregando
          ? (retiradaSelecionada ? 'Reservando retirada...' : 'Finalizando pedido...')
          : `${ctaFinalPedido} • Total ${formatarMoeda(resumoTotalPagamento)}`,
        onPrimaryClick: () => {
          void handleContinuarPagamento();
        },
        primaryDisabled: bloqueioPagamento,
        secondaryLabel: 'Voltar para entrega',
        onSecondaryClick: () => setEtapaAtual(ETAPAS.ENTREGA)
      };
    }

    if (etapaAtual === ETAPAS.PIX) {
      if (formaPagamento === 'pix') {
        return {
          stepLabel: 'Etapa 3 de 4',
          totalLabel: `Total do pedido: ${formatarMoeda(totalComEntregaPedido)}`,
          caption: podeContinuarConfirmacaoPix
            ? 'Pagamento aprovado. Siga para confirmar o pedido.'
            : 'Após pagar no banco, confirme o status aqui.',
          primaryLabel: podeContinuarConfirmacaoPix
            ? 'Ir para confirmação'
            : (verificandoStatusPix ? 'Verificando pagamento PIX...' : 'Verificar pagamento PIX'),
          onPrimaryClick: () => {
            if (podeContinuarConfirmacaoPix) {
              setPagamentoConfirmado(true);
              setEtapaAtual(ETAPAS.STATUS);
              return;
            }
            void handleVerificarPagamentoPix();
          },
          primaryDisabled: podeContinuarConfirmacaoPix
            ? false
            : (bloqueioVerificacaoPix || !pixDisponivelParaPagar),
          secondaryLabel: textoBotaoGerarPix,
          onSecondaryClick: () => {
            if (resultadoPedido?.pedido_id) {
              void handleGerarPix(resultadoPedido.pedido_id);
            }
          },
          secondaryDisabled: bloqueioGeracaoPix
        };
      }

      return {
        stepLabel: 'Etapa 3 de 4',
        totalLabel: `Total do pedido: ${formatarMoeda(totalComEntregaPedido)}`,
        caption: cartaoAprovado
          ? 'Pagamento aprovado. Siga para a confirmação.'
          : 'Conclua o pagamento no cartão para continuar.',
        primaryLabel: 'Ir para confirmação',
        onPrimaryClick: () => {
          setPagamentoConfirmado(cartaoAprovado);
          setEtapaAtual(ETAPAS.STATUS);
        },
        primaryDisabled: !cartaoProcessado,
        secondaryLabel: 'Voltar para pagamento',
        onSecondaryClick: () => setEtapaAtual(ETAPAS.PAGAMENTO)
      };
    }

    return null;
  })();

  useEffect(() => {
    if (startCheckoutTrackedRef.current) {
      return;
    }

    if (itens.length === 0) {
      return;
    }

    const cartPayload = buildCartEventPayload({
      itens,
      resumo: { total: resumo.total }
    });

    captureCommerceEvent('start_checkout', {
      ...cartPayload,
      checkout_step: etapaAtual,
      checkout_step_index: getIndiceEtapa(etapaAtual) + 1,
      delivery_type_selected: tipoEntrega,
      payment_method_selected: formaPagamento,
      authenticated_session: autenticado === true,
      currency: 'BRL'
    });

    startCheckoutTrackedRef.current = true;
  }, [autenticado, etapaAtual, formaPagamento, itens, resumo.total, tipoEntrega]);

  useEffect(() => {
    const pedidoId = Number.parseInt(String(resultadoPedido?.pedido_id || ''), 10);
    if (!pedidoId || !pagamentoAprovadoCheckout) {
      return;
    }

    if (purchaseTrackedOrdersRef.current.has(pedidoId)) {
      return;
    }

    const subtotal = Number(resultadoPedido?.total_produtos ?? resumoPedidoSnapshot?.subtotal ?? 0);
    const frete = Number(resultadoPedido?.frete_entrega ?? resumoPedidoSnapshot?.frete ?? 0);
    const total = Number(resultadoPedido?.total ?? Number((subtotal + frete).toFixed(2)));
    const itensFonte = itensPedidoSnapshot.length
      ? itensPedidoSnapshot
      : Array.isArray(resultadoPedido?.itens)
        ? resultadoPedido.itens
        : [];
    const itensPedidoTracking = buildOrderItemsPayload(itensFonte);
    const itemsCount = Number(
      resultadoPedido?.itens_count
      ?? resumoPedidoSnapshot?.itens
      ?? itensPedidoTracking.length
      ?? 0
    );

    captureCommerceEvent('purchase', {
      order_id: pedidoId,
      payment_method: String(resultadoPedido?.forma_pagamento || formaPagamento || '').toLowerCase() || null,
      delivery_type: String(resultadoPedido?.tipo_entrega || tipoEntrega || '').toLowerCase() || null,
      payment_status: String(statusPedidoAtual || resultadoPedido?.status || '').toLowerCase() || null,
      currency: 'BRL',
      subtotal: Number(subtotal.toFixed(2)),
      shipping: Number(frete.toFixed(2)),
      revenue: Number(total.toFixed(2)),
      items_count: itemsCount,
      line_items: itensPedidoTracking
    });

    purchaseTrackedOrdersRef.current.add(pedidoId);
  }, [
    formaPagamento,
    itensPedidoSnapshot,
    pagamentoAprovadoCheckout,
    resultadoPedido,
    resumoPedidoSnapshot,
    statusPedidoAtual,
    tipoEntrega
  ]);

  useEffect(() => {
    if (!feedbackCarrinho) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setFeedbackCarrinho('');
    }, 2200);

    return () => clearTimeout(timeout);
  }, [feedbackCarrinho]);

  useEffect(() => {
    if (!feedbackCopiaPix) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setFeedbackCopiaPix('');
    }, 2200);

    return () => clearTimeout(timeout);
  }, [feedbackCopiaPix]);

  useEffect(() => {
    let ativo = true;

    if (qrCodeBase64Atual || qrCodeRemotoAtual || !codigoPixAtual) {
      setQrCodePixDataUrl('');
      return () => {
        ativo = false;
      };
    }

    gerarQrCodeDataUrl(codigoPixAtual)
      .then((dataUrl) => {
        if (ativo) {
          setQrCodePixDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (ativo) {
          setQrCodePixDataUrl('');
        }
      });

    return () => {
      ativo = false;
    };
  }, [codigoPixAtual, qrCodeBase64Atual, qrCodeRemotoAtual]);

  if (verificandoSessao) {
    return (
      <section className="page">
        <h1>Finalizar pedido</h1>
        <p>Validando sua sessão...</p>
      </section>
    );
  }

  return (
    <section className={`page checkout-page ${exibirBarraMobileCheckout ? 'has-mobile-action-bar' : ''}`.trim()}>
      <h1>Finalizar pedido</h1>
      <p>Revise seu carrinho, confirme a entrega, escolha o pagamento e acompanhe a confirmação do pedido.</p>

      <CheckoutStepper currentIndex={etapaIndex} />

      <CheckoutContextBanner
        tone={contextoCheckout.tone}
        title={contextoCheckout.title}
        description={contextoCheckout.description}
        chips={contextoCheckout.chips}
      />

      {erro ? (
        <article className="checkout-inline-feedback is-error" role="alert">
          <p className="checkout-inline-feedback-title">Não foi possível concluir esta ação.</p>
          <p className="checkout-inline-feedback-text">{erro}</p>
        </article>
      ) : null}

      {(carregando || verificandoStatusPix) ? (
        <article className="checkout-inline-feedback is-loading" role="status" aria-live="polite">
          <p className="checkout-inline-feedback-title">Atualizando seu pedido</p>
          <p className="checkout-inline-feedback-text">
            {verificandoStatusPix
              ? 'Consultando o status do pagamento PIX em tempo real.'
              : mensagemProcessamentoCheckout}
          </p>
        </article>
      ) : null}

      {exibirRecaptchaCheckout ? (
        <section className="checkout-recaptcha-banner" aria-label="Validacao antiabuso">
          <p className="checkout-recaptcha-title">Validacao de seguranca</p>
          <p className="checkout-recaptcha-description">
            Confirme o reCAPTCHA antes de concluir pedido, gerar PIX ou pagar com cartao.
          </p>

          <ReCAPTCHA
            ref={recaptchaCheckoutRef}
            sitekey={RECAPTCHA_SITE_KEY}
            hl="pt-BR"
            onChange={(token) => {
              setRecaptchaCheckoutToken(String(token || '').trim());
              if (token) {
                setRecaptchaCheckoutErroCarregamento('');
              }
            }}
            onExpired={() => setRecaptchaCheckoutToken('')}
            onErrored={() => {
              setRecaptchaCheckoutToken('');
              setRecaptchaCheckoutErroCarregamento(
                'Nao foi possivel validar o reCAPTCHA neste dominio. Confira os dominios permitidos na chave do Google.'
              );
            }}
          />

          {recaptchaCheckoutErroCarregamento ? (
            <p className="error-text">{recaptchaCheckoutErroCarregamento}</p>
          ) : (
            <p className="muted-text">A validacao pode expirar; refaca o reCAPTCHA se necessario.</p>
          )}
        </section>
      ) : null}

      {etapaAtual === ETAPAS.CARRINHO ? (
        <div className="checkout-cart-layout">
          <div className="card-box checkout-cart-main">
            <div className="checkout-cart-header">
              <p className="checkout-cart-kicker">Etapa 1</p>
              <h2>Carrinho de compras</h2>
              <p className="muted-text">Revise os itens com calma, ajuste quantidades e avance quando o total estiver correto.</p>

              <CheckoutGuidanceChips
                items={[
                  'Confira quantidade e subtotal de cada item',
                  'Remova o que não vai levar',
                  'Siga para calcular frete e prazo'
                ]}
              />

              <p className="checkout-cart-live-feedback" role="status" aria-live="polite">
                {feedbackCarrinho || (carrinhoVazio
                  ? 'Nenhum item no carrinho por enquanto.'
                  : `${itensDistintosCarrinho} produtos diferentes • ${resumoItensCarrinho}.`)}
              </p>
            </div>

            {carrinhoVazio ? (
              <div className="checkout-cart-empty-state" role="status">
                <span className="checkout-cart-empty-icon" aria-hidden="true">🛒</span>
                <div>
                  <strong>Seu carrinho está vazio.</strong>
                  <p>Adicione produtos para continuar com a finalização do pedido.</p>
                  <Link className="btn-primary checkout-cart-empty-cta" to="/produtos">
                    Ir para produtos
                  </Link>
                </div>
              </div>
            ) : (
              <div className="checkout-cart-items-list">
                {itens.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={handleAtualizarQuantidadeCarrinho}
                    onRemove={handleRemoverItemCarrinho}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="checkout-cart-side">
            <CheckoutSummaryCard
              itens={resumo.itens}
              produtosDistintos={itensDistintosCarrinho}
              subtotal={resumo.total}
              tipoEntrega={tipoEntrega}
              economiaFrete={economiaFreteRetirada}
              onContinue={() => setEtapaAtual(ETAPAS.ENTREGA)}
              onClearCart={handleLimparCarrinho}
              disabled={carrinhoVazio}
            />

            <div className="card-box checkout-cart-side-card">
              <p className="checkout-cart-side-title">Quer complementar sua compra?</p>
              <p className="checkout-cart-side-copy">Volte para produtos para incluir novos itens, comparar preços e depois retomar o checkout.</p>
              <Link className="btn-secondary checkout-cart-shopping-btn" to="/produtos">
                Voltar para produtos
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.ENTREGA ? (
        <div className="checkout-delivery-layout">
          <div className="card-box checkout-delivery-main">
            <div className="checkout-delivery-header">
              <p className="checkout-delivery-kicker">Etapa 2</p>
              <h2>Entrega</h2>
              <p className="muted-text">
                {retiradaSelecionada
                  ? 'Retirada na loja ativa. Sem frete e com preparo rapido para voce buscar no balcao.'
                  : 'Informe o CEP, confira o endereço retornado e escolha a modalidade de entrega mais adequada para seu pedido.'}
              </p>

              <CheckoutGuidanceChips
                items={[
                  'Use um CEP válido de 8 dígitos',
                  'Confira o endereço retornado',
                  'Escolha o tipo de entrega para definir o total'
                ]}
              />
            </div>

            <DeliveryModeSelector
              tipoEntrega={tipoEntrega}
              onChange={(proximoTipo) => {
                const tipoNormalizado = proximoTipo === 'retirada' ? 'retirada' : 'entrega';

                if (tipoNormalizado === tipoEntrega) {
                  return;
                }

                if (tipoNormalizado === 'retirada') {
                  const freteAnterior = Number(simulacaoFrete?.frete || 0);
                  if (freteAnterior > 0) {
                    setUltimoFreteEntrega(freteAnterior);
                  }
                  setSimulacaoFrete(null);
                  setErroEntrega('');
                }

                setTipoEntrega(tipoNormalizado);
              }}
            />

            {retiradaSelecionada ? (
              <>
                <PickupStoreCard economiaFrete={economiaFreteRetirada} />

                <p
                  className={`delivery-feedback is-${mensagemFrete.tone}`}
                  role={mensagemFrete.tone === 'error' || mensagemFrete.tone === 'warning' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  {mensagemFrete.text}
                </p>
              </>
            ) : (
              <>
                <section className="checkout-delivery-section" aria-label="Cálculo de frete por CEP">
                  <label htmlFor="cep-entrega"><strong>CEP de entrega</strong></label>

                  <div className="delivery-cep-row">
                    <div className="delivery-cep-input-wrap">
                      <span className="delivery-cep-icon" aria-hidden="true">📍</span>
                      <input
                        id="cep-entrega"
                        className="field-input entrega-cep-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={9}
                        placeholder="00000-000"
                        value={cepEntrega}
                        onChange={(event) => {
                          const cepFormatado = formatarCep(event.target.value);
                          const cepNormalizado = normalizarCep(cepFormatado);

                          setCepEntrega(cepFormatado);
                          setSimulacaoFrete(null);
                          setErroEntrega('');

                          if (cepNormalizado !== cepEnderecoConsultado) {
                            setEnderecoCepEntrega(null);
                            setErroEnderecoCepEntrega('');
                            setCepEnderecoConsultado('');
                          }
                        }}
                      />
                    </div>

                    <button
                      className="btn-primary entrega-calcular-btn"
                      type="button"
                      onClick={() => {
                        void executarSimulacaoFrete();
                      }}
                      disabled={simulandoFrete || !cepEntregaValido}
                    >
                      {simulandoFrete ? 'Calculando frete...' : 'Calcular frete'}
                    </button>
                  </div>

                  {cepEntregaNormalizado ? (
                    <DeliveryAddressLookupCard
                      cep={formatarCep(cepEntregaNormalizado)}
                      endereco={enderecoCepEntrega}
                      carregando={buscandoEnderecoCepEntrega}
                      erro={erroEnderecoCepEntrega}
                      cepIncompleto={cepEntregaIncompleto}
                    />
                  ) : null}

                  <p className="delivery-cep-helper">
                    Origem da loja: CEP {CEP_MERCADO}, nº {NUMERO_MERCADO}. Bike disponível até {LIMITE_BIKE_KM.toFixed(1)} km.
                  </p>

                  <p className="delivery-cep-helper delivery-cep-helper-secondary">
                    Dica: tenha número, complemento e referência do endereço em mãos para agilizar a confirmação da entrega.
                  </p>

                  <p
                    className={`delivery-feedback is-${mensagemFrete.tone}`}
                    role={mensagemFrete.tone === 'error' || mensagemFrete.tone === 'warning' ? 'alert' : 'status'}
                    aria-live="polite"
                  >
                    {mensagemFrete.text}
                  </p>
                </section>

                <section className="checkout-delivery-section" aria-label="Opções de veículo de entrega">
                  <div className="checkout-delivery-section-head">
                    <h3>Escolha o tipo de entrega</h3>
                    <p>Selecione o veículo para estimar prazo operacional e custo do frete.</p>
                  </div>

                  <div className="delivery-options-grid" role="radiogroup" aria-label="Seleção de veículo de entrega">
                    {Object.entries(VEICULOS_ENTREGA).map(([key, veiculo]) => (
                      <DeliveryOptionCard
                        key={key}
                        veiculo={veiculo}
                        selecionado={veiculoEntrega === key}
                        recomendado={veiculoRecomendado === key}
                        onSelect={() => {
                          setVeiculoEntrega(key);
                          setSimulacaoFrete(null);
                          setErroEntrega('');
                        }}
                      />
                    ))}
                  </div>
                </section>

                {semOpcaoEntregaDisponivel ? (
                  <div className="delivery-empty-state" role="alert">
                    <span aria-hidden="true">⚠️</span>
                    <div>
                      <strong>Sem opção de entrega disponível para este CEP.</strong>
                      <p>Verifique o CEP informado ou tente outro endereço para continuar.</p>
                    </div>
                  </div>
                ) : null}

                <DeliverySummaryCard
                  veiculoLabel={veiculoSelecionadoEntrega.label}
                  cepDestino={simulacaoFrete?.cep_destino || formatarCep(cepEntrega) || '-'}
                  distanciaTexto={simulacaoFrete ? `${Number(simulacaoFrete.distancia_km || 0).toFixed(2)} km` : '-'}
                  freteTexto={simulacaoFrete ? formatarMoeda(freteAtual) : 'A calcular'}
                  totalTexto={simulacaoFrete ? formatarMoeda(totalComFreteAtual) : '-'}
                  cepOrigem={CEP_MERCADO}
                  numeroOrigem={NUMERO_MERCADO}
                />
              </>
            )}
          </div>

          <aside className="checkout-delivery-side">
            <OrderSummaryCard
              itens={resumo.itens}
              subtotal={resumo.total}
              frete={retiradaSelecionada ? 0 : simulacaoFrete ? freteAtual : null}
              total={retiradaSelecionada ? Number(resumo.total || 0) : simulacaoFrete ? totalComFreteAtual : resumo.total}
              tipoEntrega={tipoEntrega}
              economiaFrete={economiaFreteRetirada}
              veiculoLabel={atendimentoSelecionadoLabel}
            />

            <div className="card-box checkout-delivery-actions-card">
              <div className="entrega-acoes-row checkout-delivery-actions-row">
                <BotaoVoltarSeta
                  onClick={() => setEtapaAtual(ETAPAS.CARRINHO)}
                  label="Voltar ao carrinho"
                  text="Voltar ao carrinho"
                />

                <button
                  className="btn-primary entrega-ir-pagamento-btn checkout-primary-cta"
                  type="button"
                  onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)}
                  disabled={!podeAvancarParaPagamento}
                >
                  {retiradaSelecionada
                    ? `Continuar para pagamento • Total ${formatarMoeda(Number(resumo.total || 0))}`
                    : simulacaoFrete
                      ? `Continuar para pagamento • Total ${formatarMoeda(totalComFreteAtual)}`
                      : 'Continuar para pagamento'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PAGAMENTO ? (
        <div className="checkout-payment-layout">
          <div className="card-box checkout-payment-main">
            <div className="checkout-payment-header">
              <p className="checkout-payment-kicker">Etapa 3</p>
              <h2>Pagamento</h2>
              <p className="muted-text">
                Escolha o método, confirme seus dados e avance com segurança para finalizar o pedido.
              </p>

              <CheckoutGuidanceChips
                items={[
                  'Selecione a forma de pagamento',
                  'Informe CPF/CNPJ do pagador',
                  'Revise total e clique para continuar'
                ]}
              />
            </div>

            <p className={`payment-frete-info ${(retiradaSelecionada || simulacaoFrete || resultadoPedido?.pedido_id) ? 'is-ready' : 'is-warning'}`}>
              {retiradaSelecionada
                ? `Retirada na loja selecionada. Sem frete${Number(economiaFreteRetirada || 0) > 0 ? ` • Economia ${formatarMoeda(economiaFreteRetirada)}` : ''}.`
                : (simulacaoFrete || resultadoPedido?.pedido_id)
                  ? `Frete ${atendimentoSelecionadoLabel}: ${formatarMoeda(resumoFretePagamento)} • Distância ${distanciaSelecionadaTexto}`
                  : 'Frete não calculado. Volte para entrega e simule o CEP antes de continuar.'}
            </p>

            {growthCheckoutPaymentBadge ? (
              <p className={`payment-growth-badge ${growthCheckoutPaymentPriceClass}`.trim()}>
                {growthCheckoutPaymentBadge}
              </p>
            ) : null}

            <CheckoutSecurityTrust
              formaPagamento={formaPagamento}
              total={resumoTotalPagamento}
              frete={resumoFretePagamento}
              retiradaSelecionada={retiradaSelecionada}
              recaptchaEnabled={recaptchaCheckoutEnabled}
            />

            {autenticado === true ? (
              <>
                {/* Cards de método com destaque explícito para a opção ativa. */}
                <section className="checkout-payment-section" aria-label="Métodos de pagamento disponíveis">
                  <div className="checkout-payment-section-head">
                    <h3>Forma de pagamento</h3>
                    <p>Selecione o método mais adequado para concluir seu pedido.</p>
                  </div>

                  <div className="payment-methods-grid" role="radiogroup" aria-label="Seleção da forma de pagamento">
                    <PaymentMethodCard
                      icon={FORMAS_PAGAMENTO_OPCOES.pix.icon}
                      title={FORMAS_PAGAMENTO_OPCOES.pix.title}
                      headline={FORMAS_PAGAMENTO_OPCOES.pix.headline}
                      details={FORMAS_PAGAMENTO_OPCOES.pix.details}
                      selecionado={formaPagamento === 'pix'}
                      onSelect={() => {
                        setFormaPagamento('pix');
                        setErro('');
                        limparTokenCartaoGerado();
                      }}
                    />

                    <PaymentMethodCard
                      icon={FORMAS_PAGAMENTO_OPCOES.credito.icon}
                      title={FORMAS_PAGAMENTO_OPCOES.credito.title}
                      headline={FORMAS_PAGAMENTO_OPCOES.credito.headline}
                      details={buscandoChavePublica
                        ? [...FORMAS_PAGAMENTO_OPCOES.credito.details, 'Temporariamente indisponível: preparando conexão segura.']
                        : FORMAS_PAGAMENTO_OPCOES.credito.details}
                      selecionado={formaPagamento === 'credito'}
                      disabled={buscandoChavePublica}
                      onSelect={() => {
                        setFormaPagamento('credito');
                        setErro('');
                        limparTokenCartaoGerado();
                      }}
                    />

                    <PaymentMethodCard
                      icon={FORMAS_PAGAMENTO_OPCOES.debito.icon}
                      title={FORMAS_PAGAMENTO_OPCOES.debito.title}
                      headline={FORMAS_PAGAMENTO_OPCOES.debito.headline}
                      details={buscandoChavePublica
                        ? [...FORMAS_PAGAMENTO_OPCOES.debito.details, 'Temporariamente indisponível: preparando conexão segura.']
                        : FORMAS_PAGAMENTO_OPCOES.debito.details}
                      selecionado={formaPagamento === 'debito'}
                      disabled={buscandoChavePublica}
                      onSelect={() => {
                        setFormaPagamento('debito');
                        setParcelasCartao('1');
                        setErro('');
                        limparTokenCartaoGerado();
                      }}
                    />
                  </div>

                  {buscandoChavePublica ? (
                    <p className="payment-method-unavailable" role="status">
                      Métodos no cartão temporariamente indisponíveis enquanto preparamos a conexão segura com o gateway.
                    </p>
                  ) : null}
                </section>

                <PaymentSelectionSummary
                  title={formaPagamentoAtual.summaryTitle}
                  description={formaPagamentoAtual.summaryDescription}
                />

                <TaxIdInput
                  value={documentoPagador}
                  onChange={(event) => {
                    setDocumentoPagador(formatarDocumentoFiscal(event.target.value));
                    if (erro) {
                      setErro('');
                    }
                  }}
                  onBlur={() => setDocumentoTocado(true)}
                  requiredError={documentoObrigatorioNaoPreenchido}
                  invalidError={documentoInvalidoPagamento}
                  validFeedback={documentoValidoFeedback}
                />

                {pagamentoCartaoSelecionado ? (
                  <section className="payment-card-panel" aria-label="Dados do cartão">
                    <div className="payment-card-panel-head">
                      <h3>{formaPagamento === 'credito' ? 'Dados do cartão de crédito' : 'Dados do cartão de débito'}</h3>
                      <p>Preencha os dados exatamente como no cartão para reduzir chance de recusa.</p>
                    </div>

                    <div className="payment-card-grid">
                      <div className="payment-card-field payment-card-field-span-2">
                        <label htmlFor="nome-titular-cartao">Nome impresso no cartão</label>
                        <input
                          id="nome-titular-cartao"
                          className="field-input"
                          type="text"
                          autoComplete="off"
                          placeholder="Nome igual ao cartão"
                          value={nomeTitularCartao}
                          onChange={(event) => {
                            setNomeTitularCartao(event.target.value);
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      <div className="payment-card-field payment-card-field-span-2">
                        <label htmlFor="numero-cartao">Número do cartão</label>
                        <input
                          id="numero-cartao"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          placeholder="0000 0000 0000 0000"
                          value={numeroCartao}
                          onChange={(event) => {
                            setNumeroCartao(formatarNumeroCartao(event.target.value));
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      <div className="payment-card-field">
                        <label htmlFor="mes-expiracao-cartao">Mês</label>
                        <input
                          id="mes-expiracao-cartao"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp-month"
                          placeholder="MM"
                          maxLength={2}
                          value={mesExpiracaoCartao}
                          onChange={(event) => {
                            setMesExpiracaoCartao(formatarMesCartao(event.target.value));
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      <div className="payment-card-field">
                        <label htmlFor="ano-expiracao-cartao">Ano</label>
                        <input
                          id="ano-expiracao-cartao"
                          className="field-input"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp-year"
                          placeholder="AAAA"
                          maxLength={4}
                          value={anoExpiracaoCartao}
                          onChange={(event) => {
                            setAnoExpiracaoCartao(formatarAnoCartao(event.target.value));
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      <div className="payment-card-field">
                        <label htmlFor="cvv-cartao">CVV</label>
                        <input
                          id="cvv-cartao"
                          className="field-input"
                          type="password"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          placeholder="CVV"
                          maxLength={4}
                          value={cvvCartao}
                          onChange={(event) => {
                            setCvvCartao(formatarCvvCartao(event.target.value));
                            limparTokenCartaoGerado();
                          }}
                        />
                      </div>

                      {formaPagamento === 'credito' ? (
                        <div className="payment-card-field payment-card-field-span-2">
                          <label htmlFor="parcelas-cartao">Parcelas</label>
                          <select
                            id="parcelas-cartao"
                            className="field-input"
                            value={parcelasCartao}
                            onChange={(event) => setParcelasCartao(event.target.value)}
                          >
                            {Array.from({ length: parcelamentoCreditoDisponivel ? PARCELAMENTO_MAXIMO_CREDITO : 1 }, (_, idx) => idx + 1).map((parcela) => (
                              <option key={parcela} value={String(parcela)}>
                                {parcela}x
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>

                    {formaPagamento === 'credito' ? (
                      <p className="payment-card-note">
                        {parcelamentoCreditoDisponivel
                          ? `Parcelamento liberado para este pedido (até ${PARCELAMENTO_MAXIMO_CREDITO}x).`
                          : `Parcelamento disponível apenas para pedidos a partir de R$ ${valorMinimoParcelamentoTexto}.`}
                      </p>
                    ) : (
                      <p className="payment-card-note">No débito, o pagamento é sempre à vista (1x).</p>
                    )}

                    <div className="payment-card-actions">
                      <button
                        className="btn-secondary payment-validate-card-btn"
                        type="button"
                        disabled={criptografandoCartao || buscandoChavePublica}
                        onClick={() => {
                          void handleCriptografarCartao().catch((error) => {
                            setErro(error.message || 'Não foi possível validar os dados do cartão.');
                          });
                        }}
                      >
                        {criptografandoCartao ? 'Validando dados do cartão...' : 'Validar cartão com segurança'}
                      </button>

                      <p className={`payment-card-token-feedback ${tokenCartao ? 'is-success' : ''}`.trim()}>
                        {tokenCartao
                          ? 'Dados do cartão validados com sucesso.'
                          : 'Os dados do cartão são protegidos antes do envio para pagamento.'}
                      </p>

                      {debitoSelecionado ? (
                        <>
                          <p className={`payment-action-feedback ${status3DSTone}`.trim()} role="status">
                            {status3DSLabel}
                            {idAutenticacao3DS ? ` ID: ${idAutenticacao3DS}` : ''}
                          </p>

                          {IS_DEVELOPMENT && resultado3DS?.trace_id ? (
                            <p className="muted-text">Trace 3DS: {resultado3DS.trace_id}</p>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <div className="payment-login-state">
                <p className="muted-text">Faça login para continuar com o pagamento e acompanhar seu pedido.</p>
                <div className="checkout-payment-actions">
                  <BotaoVoltarSeta
                    onClick={() => setEtapaAtual(ETAPAS.ENTREGA)}
                    label="Voltar para entrega"
                    text="Voltar"
                    className="payment-back-btn"
                  />
                  <Link to="/conta" className="btn-primary entrega-ir-pagamento-btn checkout-payment-primary-btn">
                    Ir para Conta
                  </Link>
                </div>
              </div>
            )}
          </div>

          <aside className="checkout-payment-side">
            {/* Resumo financeiro com maior visibilidade antes da confirmação. */}
            <PaymentOrderSummary
              itens={resumoItensPagamento}
              subtotal={totalProdutosPedido}
              frete={resumoFretePagamento}
              total={resumoTotalPagamento}
              metodo={formaPagamentoAtual.title}
              tipoEntrega={tipoEntrega}
              economiaFrete={economiaFreteRetirada}
              className={growthCheckoutPaymentPriceClass}
            />

            {autenticado === true ? (
              <div className="card-box checkout-payment-actions-card">
                <article className="payment-readiness-card" aria-label="Checklist para continuar">
                  <p className="payment-readiness-title">Checklist antes de continuar</p>

                  <ul className="payment-readiness-list">
                    {checklistPagamento.map((item) => (
                      <li key={item.id} className={item.ok ? 'is-ok' : 'is-pending'}>
                        <span className="payment-readiness-icon" aria-hidden="true">{item.ok ? '✓' : '•'}</span>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                {mensagemBloqueioPagamento ? (
                  <p className="payment-action-feedback is-warning" role="status">{mensagemBloqueioPagamento}</p>
                ) : null}

                {buscandoChavePublica ? (
                  <p className="payment-action-feedback is-loading" role="status">Preparando conexão segura com o gateway de cartão...</p>
                ) : null}

                <div className="checkout-payment-actions">
                  <BotaoVoltarSeta
                    onClick={() => setEtapaAtual(ETAPAS.ENTREGA)}
                    label="Voltar para entrega"
                    text="Voltar para entrega"
                    className="payment-back-btn"
                  />

                  <button
                    className="btn-primary checkout-payment-primary-btn"
                    type="button"
                    onClick={() => {
                      void handleContinuarPagamento();
                    }}
                    disabled={bloqueioPagamento}
                  >
                    {carregando
                      ? (retiradaSelecionada ? 'Reservando retirada...' : 'Finalizando pedido...')
                      : `${ctaFinalPedido} • Total ${formatarMoeda(resumoTotalPagamento)}`}
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.PIX ? (
        <div className="checkout-pix-layout">
          <div className="card-box checkout-pix-main">
            <div className="checkout-pix-header">
              <p className="checkout-pix-kicker">Etapa 3</p>
              <h2>{formaPagamento === 'pix' ? 'Pagamento via PIX' : `Pagamento com ${tituloFormaPagamento}`}</h2>
              <p className="muted-text">
                {formaPagamento === 'pix'
                  ? 'Escaneie o QR Code ou copie o código PIX e confirme o status para liberar a confirmação do pedido.'
                  : `Finalize o pagamento com ${tituloFormaPagamento.toLowerCase()} para seguir para a confirmação.`}
              </p>

              <CheckoutGuidanceChips
                items={formaPagamento === 'pix'
                  ? ['Gerar QR Code', 'Pagar no app do banco', 'Verificar status e confirmar pedido']
                  : ['Concluir pagamento no cartão', 'Conferir status do pedido', 'Seguir para confirmação']}
              />
            </div>

            <CheckoutSecurityTrust
              formaPagamento={formaPagamento}
              total={totalComEntregaPedido}
              frete={freteSelecionado}
              retiradaSelecionada={retiradaSelecionada}
              recaptchaEnabled={recaptchaCheckoutEnabled}
              compact
            />

            {formaPagamento === 'pix' ? (
              <>
                {/* Estrutura principal do PIX com QR em destaque e código copia e cola. */}
                <section className="checkout-pix-payment-panel" aria-label="Pagamento PIX">
                  <div className="checkout-pix-payment-grid">
                    <PixQrCodeCard qrCodeSrc={qrCodePixSrc} carregando={carregando} />

                    <PixCopyCodeCard
                      codigoPix={codigoPixAtual}
                      onCopy={() => {
                        void handleCopiarCodigoPix();
                      }}
                      feedbackCopia={feedbackCopiaPix}
                      disabled={carregando}
                    />
                  </div>

                  <PixInstructionsCard />
                </section>

                <PixStatusCard statusVisual={statusPixVisual} />
              </>
            ) : (
              <section className="checkout-pix-payment-panel" aria-label="Pagamento com cartão">
                {debitoSelecionado ? (
                  <p className={`payment-action-feedback ${status3DSTone}`.trim()} role="status">
                    {status3DSLabel}
                  </p>
                ) : null}

                <button
                  className="btn-secondary"
                  type="button"
                  disabled={carregando || criptografandoCartao || !resultadoPedido?.pedido_id || !recaptchaCheckoutPronto}
                  onClick={() => handlePagarCartao(resultadoPedido.pedido_id)}
                >
                  {carregando
                    ? debitoSelecionado
                      ? status3DSLabel
                      : `Processando ${tituloFormaPagamento.toLowerCase()}...`
                    : `Pagar com ${tituloFormaPagamento}`}
                </button>

                {resultadoCartao ? (
                  <>
                    <p>Status do pagamento: {formatarStatusPagamento(resultadoCartao.status)}</p>
                    <p>Status do pedido: {formatarStatusPedido(resultadoCartao.status_interno || 'pendente')}</p>
                    <p>Referência do pedido no PagBank: {resultadoCartao.pagbank_order_id || '-'}</p>
                    <p>Referência lógica: {resultadoCartao.reference_id || '-'}</p>
                    <p>Referência da transação: {resultadoCartao.payment_id || '-'}</p>
                    <p>Método: {resultadoCartao.tipo_cartao === 'debito' ? 'Cartão de Débito' : 'Cartão de Crédito'}</p>
                    <p>Parcelas: {resultadoCartao.tipo_cartao === 'debito' ? '1x' : `${resultadoCartao.parcelas || parcelasCartaoEfetivas}x`}</p>
                    {debitoSelecionado ? (
                      <>
                        <p>Charge status: {String(resultadoCartao.status_charge || '-').toUpperCase()}</p>
                        <p>Charge 3DS status: {String(resultadoCartao.status_charge_threeds || '-').toUpperCase()}</p>
                        <p>Payment response code: {resultadoCartao.payment_response?.code || resultadoCartao.authorization_code || '-'}</p>
                        <p>Payment response message: {resultadoCartao.payment_response?.message || resultadoCartao.message || '-'}</p>
                      </>
                    ) : null}
                    {cartaoRecusado ? (
                      <p className="error-text">Pagamento não aprovado. Revise os dados do cartão e tente novamente.</p>
                    ) : null}
                  </>
                ) : (
                  <p className="muted-text">Revise os dados e conclua o pagamento para liberar a confirmação do pedido.</p>
                )}

                {debitoSelecionado && eventosHomologacao3DS.length > 0 ? (
                  <div className="payment-homologacao-logs" aria-label="Evidencia sanitizada de homologacao 3DS">
                    <p className="payment-homologacao-logs-title">Evidência de homologação 3DS (dados mascarados)</p>

                    <div className="payment-homologacao-logs-actions">
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => {
                          void handleCopiarEvidenciaHomologacao3DS();
                        }}
                      >
                        Copiar log sanitizado
                      </button>

                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={handleBaixarEvidenciaHomologacao3DS}
                      >
                        Baixar JSON sanitizado
                      </button>
                    </div>

                    {feedbackEvidencia3DS ? (
                      <p className={`payment-action-feedback ${feedbackEvidencia3DSTone}`.trim()} role="status">
                        {feedbackEvidencia3DS}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            )}
          </div>

          <aside className="checkout-pix-side">
            <PaymentOrderSummary
              itens={itensResumoPixExibicao}
              subtotal={Number(resultadoPedido?.total_produtos ?? resumoPedidoSnapshot?.subtotal ?? totalProdutosPedido)}
              frete={freteSelecionado}
              total={totalComEntregaPedido}
              metodo={formaPagamento === 'pix' ? 'PIX' : tituloFormaPagamento}
              className={growthCheckoutPaymentPriceClass}
            />

            <div className="card-box checkout-pix-actions-card">
              <p className="pix-order-meta">Pedido #{resultadoPedido?.pedido_id || '-'}</p>

              {formaPagamento === 'pix' ? (
                <>
                  <button
                    className={`${pixDisponivelParaPagar ? 'btn-secondary' : 'btn-primary'} checkout-pix-generate-btn`.trim()}
                    type="button"
                    disabled={bloqueioGeracaoPix}
                    onClick={() => handleGerarPix(resultadoPedido.pedido_id)}
                  >
                    {textoBotaoGerarPix}
                  </button>

                  {podeContinuarConfirmacaoPix ? (
                    <button
                      className="btn-primary checkout-pix-primary-btn"
                      type="button"
                      onClick={() => {
                        setPagamentoConfirmado(true);
                        setEtapaAtual(ETAPAS.STATUS);
                      }}
                    >
                      Continuar para confirmação do pedido
                    </button>
                  ) : (
                    <button
                      className={`${pixDisponivelParaPagar ? 'btn-primary' : 'btn-secondary'} checkout-pix-primary-btn`.trim()}
                      type="button"
                      onClick={() => {
                        void handleVerificarPagamentoPix();
                      }}
                      disabled={bloqueioVerificacaoPix || !pixDisponivelParaPagar}
                    >
                      {verificandoStatusPix ? 'Verificando pagamento PIX...' : 'Verificar pagamento PIX'}
                    </button>
                  )}

                  {!podeContinuarConfirmacaoPix ? (
                    <p className="pix-action-helper">A confirmação só é liberada após aprovação do pagamento PIX.</p>
                  ) : null}
                </>
              ) : (
                <button
                  className="btn-primary checkout-pix-primary-btn"
                  type="button"
                  disabled={!cartaoProcessado}
                  onClick={() => {
                    setPagamentoConfirmado(cartaoAprovado);
                    setEtapaAtual(ETAPAS.STATUS);
                  }}
                >
                  Continuar para confirmação
                </button>
              )}

              <BotaoVoltarSeta
                onClick={() => setEtapaAtual(ETAPAS.PAGAMENTO)}
                label="Voltar para pagamento"
                text="Voltar para pagamento"
                className="payment-back-btn"
              />
            </div>
          </aside>
        </div>
      ) : null}

      {etapaAtual === ETAPAS.STATUS ? (
        <div className="card-box">
          <p><strong>Etapa 4: Confirmação e acompanhamento</strong></p>
          {resultadoPedido ? (
            <>
              <p>Pedido: #{resultadoPedido.pedido_id}</p>
              <p>Total com entrega estimado: {formatarMoeda(totalComEntregaPedido)}</p>
              <p>
                Situação atual: <span className="pedido-status-badge">{labelStatus}</span>
              </p>
              {pagamentoConfirmado ? (
                <div className="pagamento-ok" aria-label="Pagamento confirmado com sucesso">
                  <span className="pagamento-ok-icon">✅</span>
                  <span>Pagamento confirmado com sucesso.</span>
                </div>
              ) : (
                <p className="checkout-status-pending" role="status">
                  Ainda estamos aguardando a confirmação final do pagamento. Mantenha esta tela aberta para acompanhar.
                </p>
              )}
              <p className="muted-text">Atualização automática a cada 15 segundos.</p>
            </>
          ) : (
            <p className="muted-text">Finalize um pedido para acompanhar o status.</p>
          )}

          <div className="card-box" style={{ marginTop: '0.4rem' }}>
            <p><strong>Precisa de ajuda?</strong></p>
            <p>
              {formaPagamento === 'pix'
                ? 'Se o QR Code não abrir no seu banco, copie o código PIX e cole manualmente no aplicativo.'
                : 'Se o pagamento não for aprovado, revise os dados do cartão e tente novamente.'}
            </p>
            <p>Após a confirmação do pagamento, iniciamos a preparação e o envio do pedido.</p>
          </div>

          <BotaoVoltarSeta
            onClick={() => setEtapaAtual(ETAPAS.PIX)}
            label="Voltar para pagamento"
            text="Voltar para pagamento"
          />
        </div>
      ) : null}

      <CheckoutMobileActionBar
        visible={exibirBarraMobileCheckout}
        stepLabel={mobileActionBarConfig?.stepLabel}
        totalLabel={mobileActionBarConfig?.totalLabel}
        caption={mobileActionBarConfig?.caption}
        primaryLabel={mobileActionBarConfig?.primaryLabel}
        onPrimaryClick={mobileActionBarConfig?.onPrimaryClick}
        primaryDisabled={Boolean(mobileActionBarConfig?.primaryDisabled)}
        secondaryLabel={mobileActionBarConfig?.secondaryLabel}
        secondaryTo={mobileActionBarConfig?.secondaryTo}
        onSecondaryClick={mobileActionBarConfig?.onSecondaryClick}
        secondaryDisabled={Boolean(mobileActionBarConfig?.secondaryDisabled)}
      />
    </section>
  );
}

