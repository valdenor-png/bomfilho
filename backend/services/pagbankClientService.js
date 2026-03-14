'use strict';

const fetch = global.fetch || require('node-fetch');

async function enviarPostPagBankOrders({
  apiUrl,
  headers,
  payload,
  registrarLogPagBank,
  fetchImpl = fetch
} = {}) {
  const endpoint = `${String(apiUrl || '').replace(/\/+$/, '')}/orders`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {})
  });

  const responseBodyText = await response.text().catch(() => '');

  let responsePayload = {};
  try {
    responsePayload = responseBodyText ? JSON.parse(responseBodyText) : {};
  } catch {
    responsePayload = { raw_text: responseBodyText };
  }

  if (typeof registrarLogPagBank === 'function') {
    registrarLogPagBank({
      operacao: 'orders.post',
      endpoint,
      method: 'POST',
      httpStatus: response.status,
      requestPayload: payload,
      responsePayload
    });
  }

  return {
    response,
    responseBodyText,
    responsePayload,
    endpoint
  };
}

async function obterPedidoPagBank({
  apiUrl,
  token,
  orderId,
  registrarLogPagBank,
  fetchImpl = fetch
} = {}) {
  if (!token) return null;
  if (!orderId) return null;

  const endpoint = `${String(apiUrl || '').replace(/\/+$/, '')}/orders/${orderId}`;
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  const responseText = await response.text().catch(() => '');
  let responsePayload = {};
  try {
    responsePayload = responseText ? JSON.parse(responseText) : {};
  } catch {
    responsePayload = { raw_text: responseText };
  }

  if (typeof registrarLogPagBank === 'function') {
    registrarLogPagBank({
      operacao: 'orders.get',
      endpoint,
      method: 'GET',
      httpStatus: response.status,
      responsePayload,
      extra: { order_id: orderId }
    });
  }

  if (!response.ok) {
    const detalheErro = typeof responsePayload?.raw_text === 'string'
      ? responsePayload.raw_text
      : JSON.stringify(responsePayload);
    throw new Error(`Erro ao consultar PagBank order ${orderId}: ${response.status} - ${detalheErro}`);
  }

  return responsePayload;
}

module.exports = {
  enviarPostPagBankOrders,
  obterPedidoPagBank
};
