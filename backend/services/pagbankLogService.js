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

function mascararEmail(valor) {
  const email = String(valor || '').trim();
  const [usuario, dominio] = email.split('@');

  if (!usuario || !dominio) {
    return mascararTextoSensivel(email, { prefixo: 2, sufixo: 2 });
  }

  const inicioUsuario = usuario.slice(0, 2);
  const dominioPartes = dominio.split('.');
  const dominioPrincipal = dominioPartes[0] || '';
  const sufixo = dominioPartes.length > 1 ? `.${dominioPartes.slice(1).join('.')}` : '';

  return `${inicioUsuario}***@${dominioPrincipal.slice(0, 1)}***${sufixo}`;
}

function mascararCpfCnpj(valor) {
  const digits = String(valor || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

function mascararNumeroCartao(valor) {
  const digits = String(valor || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 2)}***`;
  }

  return `${digits.slice(0, 6)}***${digits.slice(-4)}`;
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

  if (['authorization', 'session', 'session_id', 'checkout_session'].includes(key)) {
    return true;
  }

  if (['cvv', 'securitycode', 'security_code'].includes(key)) {
    return true;
  }

  if (key === 'number' && (pathKey.includes('.card') || pathKey.includes('.paymentmethod.card'))) {
    return true;
  }

  if (['email', 'email_address'].includes(key)) {
    return true;
  }

  return false;
}

function mascararTokensEmTexto(texto) {
  return String(texto || '')
    .replace(/(authorization\s*[:=]\s*bearer\s+)([^\s"']+)/gi, '$1***')
    .replace(/(bearer\s+)([^\s"']+)/gi, '$1***')
    .replace(
    /([?&](?:token|access_token|signature|webhook_token)=)([^&]+)/gi,
    '$1***'
    );
}

function mascararEmailsEmTexto(texto) {
  return String(texto || '').replace(
    /([A-Z0-9._%+-]{1,64})@([A-Z0-9.-]+\.[A-Z]{2,})/gi,
    (match) => mascararEmail(match)
  );
}

function sanitizarPayloadPagBankParaLog(valor, caminho = 'root') {
  if (Array.isArray(valor)) {
    return valor.map((item, index) => sanitizarPayloadPagBankParaLog(item, `${caminho}[${index}]`));
  }

  if (typeof valor === 'string') {
    const textoComTokensOcultos = mascararTokensEmTexto(valor);
    return mascararEmailsEmTexto(textoComTokensOcultos);
  }

  if (!valor || typeof valor !== 'object') {
    return valor;
  }

  const saida = {};

  for (const [chave, conteudo] of Object.entries(valor)) {
    if (deveMascararCampoLog({ chave, caminho })) {
      const key = String(chave || '').toLowerCase();

      if (['tax_id', 'cpf', 'cnpj'].includes(key)) {
        saida[chave] = mascararCpfCnpj(conteudo);
      } else if (['email', 'email_address'].includes(key)) {
        saida[chave] = mascararEmail(conteudo);
      } else if (key === 'number' && String(caminho || '').toLowerCase().includes('card')) {
        saida[chave] = mascararNumeroCartao(conteudo);
      } else {
        saida[chave] = mascararTextoSensivel(conteudo);
      }

      continue;
    }

    saida[chave] = sanitizarPayloadPagBankParaLog(conteudo, `${caminho}.${chave}`);
  }

  return saida;
}

function extrairTraceIdPagBank(payload = {}) {
  const candidatosDiretos = [
    payload?.trace_id,
    payload?.traceId,
    payload?.request_id,
    payload?.requestId,
    payload?.error?.trace_id,
    payload?.error?.traceId
  ];

  for (const candidato of candidatosDiretos) {
    const valor = String(candidato || '').trim();
    if (valor) {
      return valor;
    }
  }

  const errorMessages = Array.isArray(payload?.error_messages)
    ? payload.error_messages
    : Array.isArray(payload?.errors)
      ? payload.errors
      : [];

  for (const erro of errorMessages) {
    const valor = String(erro?.trace_id || erro?.traceId || erro?.request_id || erro?.requestId || '').trim();
    if (valor) {
      return valor;
    }
  }

  return '';
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

    const traceId = String(extra?.trace_id || extra?.traceId || extrairTraceIdPagBank(responsePayload) || '').trim();
    const logSeguro = {
      operacao: String(operacao || 'pagbank'),
      method: String(method || 'POST').toUpperCase(),
      endpoint: String(endpoint || ''),
      http_status: Number.isFinite(Number(httpStatus)) ? Number(httpStatus) : null,
      trace_id: traceId || undefined,
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
  sanitizarPayloadPagBankParaLog,
  extrairTraceIdPagBank
};
