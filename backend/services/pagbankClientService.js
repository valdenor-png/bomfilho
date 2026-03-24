'use strict';

const fetch = global.fetch;
const { extrairTraceIdPagBank } = require('./pagbankLogService');

function parseJsonSafely(responseBodyText) {
  if (!responseBodyText) {
    return {};
  }

  try {
    return JSON.parse(responseBodyText);
  } catch {
    return { raw_text: responseBodyText };
  }
}

function parseTimeoutMs(timeoutMs, fallback = 15000) {
  const parsed = Number.parseInt(String(timeoutMs || ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return fallback;
  }

  return Math.min(parsed, 120000);
}

async function executarFetchComTimeout({ fetchImpl, endpoint, options, timeoutMs }) {
  const timeoutAplicado = parseTimeoutMs(timeoutMs);
  if (typeof AbortController === 'undefined') {
    return fetchImpl(endpoint, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutAplicado);

  try {
    return await fetchImpl(endpoint, {
      ...options,
      signal: options?.signal || controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Tempo limite excedido ao chamar PagBank (${timeoutAplicado}ms).`);
      timeoutError.code = 'PAGBANK_TIMEOUT';
      timeoutError.httpStatus = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function lerRespostaHttp(response) {
  const responseBodyText = await response.text().catch(() => '');
  const responsePayload = parseJsonSafely(responseBodyText);

  return {
    responseBodyText,
    responsePayload
  };
}

function extrairTraceIdRespostaHttp(response, responsePayload) {
  const fromPayload = String(extrairTraceIdPagBank(responsePayload) || '').trim();
  if (fromPayload) {
    return fromPayload;
  }

  const headers = response?.headers;
  const candidatos = [
    headers?.get?.('x-trace-id'),
    headers?.get?.('trace-id'),
    headers?.get?.('x-request-id'),
    headers?.get?.('request-id')
  ];

  for (const candidato of candidatos) {
    const valor = String(candidato || '').trim();
    if (valor) {
      return valor;
    }
  }

  return '';
}

function extrairSession3DSPagBank(payload = {}) {
  const candidatos = [
    payload?.session,
    payload?.checkout_session,
    payload?.session_id,
    payload?.id,
    payload?.token,
    payload?.data?.session,
    payload?.result?.session
  ];

  for (const candidato of candidatos) {
    const valor = String(candidato || '').trim();
    if (valor) {
      return valor;
    }
  }

  return '';
}

async function enviarPostPagBankOrders({
  apiUrl,
  headers,
  payload,
  registrarLogPagBank,
  timeoutMs = 15000,
  fetchImpl = fetch
} = {}) {
  const endpoint = `${String(apiUrl || '').replace(/\/+$/, '')}/orders`;
  const response = await executarFetchComTimeout({
    fetchImpl,
    endpoint,
    timeoutMs,
    options: {
      method: 'POST',
      headers,
      body: JSON.stringify(payload || {})
    }
  });

  const { responseBodyText, responsePayload } = await lerRespostaHttp(response);
  const traceId = extrairTraceIdRespostaHttp(response, responsePayload);

  if (typeof registrarLogPagBank === 'function') {
    registrarLogPagBank({
      operacao: 'orders.post',
      endpoint,
      method: 'POST',
      httpStatus: response.status,
      requestPayload: payload,
      responsePayload,
      extra: {
        trace_id: traceId || undefined
      }
    });
  }

  return {
    response,
    responseBodyText,
    responsePayload,
    traceId,
    endpoint
  };
}

async function obterPedidoPagBank({
  apiUrl,
  token,
  orderId,
  registrarLogPagBank,
  timeoutMs = 15000,
  fetchImpl = fetch
} = {}) {
  if (!token) return null;
  if (!orderId) return null;

  const endpoint = `${String(apiUrl || '').replace(/\/+$/, '')}/orders/${orderId}`;
  const response = await executarFetchComTimeout({
    fetchImpl,
    endpoint,
    timeoutMs,
    options: {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  });

  const { responseBodyText: _responseText, responsePayload } = await lerRespostaHttp(response);
  const traceId = extrairTraceIdRespostaHttp(response, responsePayload);

  if (typeof registrarLogPagBank === 'function') {
    registrarLogPagBank({
      operacao: 'orders.get',
      endpoint,
      method: 'GET',
      httpStatus: response.status,
      responsePayload,
      extra: {
        order_id: orderId,
        trace_id: traceId || undefined
      }
    });
  }

  if (!response.ok) {
    const detalheErro = typeof responsePayload?.raw_text === 'string'
      ? responsePayload.raw_text
      : JSON.stringify(responsePayload);
    const error = new Error(`Erro ao consultar PagBank order ${orderId}: ${response.status} - ${detalheErro}`);
    error.httpStatus = response.status;
    error.traceId = traceId || undefined;
    error.endpoint = endpoint;
    error.responsePayload = responsePayload;
    throw error;
  }

  return responsePayload;
}

async function criarSessaoAutenticacao3DSPagBank({
  sdkApiUrl,
  token,
  registrarLogPagBank,
  timeoutMs = 15000,
  fetchImpl = fetch
} = {}) {
  if (!token) {
    const error = new Error('Token PagBank ausente para criar sessao 3DS.');
    error.httpStatus = 503;
    throw error;
  }

  const endpoint = `${String(sdkApiUrl || '').replace(/\/+$/, '')}/checkout-sdk/sessions`;
  const response = await executarFetchComTimeout({
    fetchImpl,
    endpoint,
    timeoutMs,
    options: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }
  });

  const { responseBodyText, responsePayload } = await lerRespostaHttp(response);
  const traceId = extrairTraceIdRespostaHttp(response, responsePayload);

  if (typeof registrarLogPagBank === 'function') {
    registrarLogPagBank({
      operacao: '3ds.session.post',
      endpoint,
      method: 'POST',
      httpStatus: response.status,
      responsePayload,
      extra: {
        trace_id: traceId || undefined
      }
    });
  }

  if (!response.ok) {
    const detalheErro = responseBodyText
      || (typeof responsePayload?.raw_text === 'string' ? responsePayload.raw_text : JSON.stringify(responsePayload));
    const error = new Error(`Erro ao criar sessao 3DS PagBank: ${response.status} - ${detalheErro}`);
    error.httpStatus = response.status;
    error.endpoint = endpoint;
    error.traceId = traceId || undefined;
    error.responsePayload = responsePayload;
    throw error;
  }

  const session = extrairSession3DSPagBank(responsePayload);
  if (!session) {
    const error = new Error('Resposta do PagBank nao retornou session valida para o fluxo 3DS.');
    error.httpStatus = 502;
    error.endpoint = endpoint;
    error.traceId = traceId || undefined;
    error.responsePayload = responsePayload;
    throw error;
  }

  return {
    session,
    responsePayload,
    endpoint,
    traceId,
    httpStatus: response.status
  };
}

module.exports = {
  enviarPostPagBankOrders,
  obterPedidoPagBank,
  criarSessaoAutenticacao3DSPagBank
};
