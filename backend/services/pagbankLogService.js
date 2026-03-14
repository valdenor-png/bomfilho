'use strict';

function mascararTextoSensivel(valor, { prefixo = 6, sufixo = 4 } = {}) {
  const texto = String(valor || '').trim();
  if (!texto) {
    return '';
  }

  if (texto.length <= prefixo + sufixo) {
    return `${texto.slice(0, 2)}***`;
  }

  return `${texto.slice(0, prefixo)}***${texto.slice(-sufixo)}`;
}

function deveMascararCampoLog({ chave, caminho }) {
  const key = String(chave || '').toLowerCase();
  const pathKey = `${String(caminho || '').toLowerCase()}.${key}`;

  if (['token_cartao', 'cartao_encriptado', 'encrypted', 'encryptedcard'].includes(key)) {
    return true;
  }

  if (['tax_id', 'cpf', 'cnpj', 'x-webhook-token', 'webhook_token'].includes(key)) {
    return true;
  }

  if (key === 'token' || key.endsWith('_token')) {
    return true;
  }

  if (['cvv', 'securitycode', 'security_code'].includes(key)) {
    return true;
  }

  if (key === 'number' && pathKey.includes('.card')) {
    return true;
  }

  return false;
}

function mascararTokensEmTexto(texto) {
  return String(texto || '').replace(
    /([?&](?:token|access_token|signature|webhook_token)=)([^&]+)/gi,
    '$1***'
  );
}

function sanitizarPayloadPagBankParaLog(valor, caminho = 'root') {
  if (Array.isArray(valor)) {
    return valor.map((item, index) => sanitizarPayloadPagBankParaLog(item, `${caminho}[${index}]`));
  }

  if (typeof valor === 'string') {
    return mascararTokensEmTexto(valor);
  }

  if (!valor || typeof valor !== 'object') {
    return valor;
  }

  const saida = {};

  for (const [chave, conteudo] of Object.entries(valor)) {
    if (deveMascararCampoLog({ chave, caminho })) {
      saida[chave] = mascararTextoSensivel(conteudo);
      continue;
    }

    saida[chave] = sanitizarPayloadPagBankParaLog(conteudo, `${caminho}.${chave}`);
  }

  return saida;
}

function criarRegistradorLogPagBank({ ativo = false, logger = console.log } = {}) {
  return function registrarLogPagBank({
    operacao,
    endpoint,
    method,
    httpStatus,
    requestPayload,
    responsePayload,
    extra
  } = {}) {
    if (!ativo) {
      return;
    }

    const logSeguro = {
      operacao: String(operacao || 'pagbank'),
      method: String(method || 'POST').toUpperCase(),
      endpoint: String(endpoint || ''),
      http_status: Number.isFinite(Number(httpStatus)) ? Number(httpStatus) : null,
      request: requestPayload !== undefined ? sanitizarPayloadPagBankParaLog(requestPayload) : undefined,
      response: responsePayload !== undefined ? sanitizarPayloadPagBankParaLog(responsePayload) : undefined,
      extra: extra !== undefined ? sanitizarPayloadPagBankParaLog(extra) : undefined,
      timestamp: new Date().toISOString()
    };

    logger(`PagBank debug: ${JSON.stringify(logSeguro)}`);
  };
}

module.exports = {
  criarRegistradorLogPagBank,
  sanitizarPayloadPagBankParaLog
};
