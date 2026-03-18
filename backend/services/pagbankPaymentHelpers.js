'use strict';

function normalizarParcelasCartao(valor) {
  const parcelas = Number.parseInt(valor, 10);
  if (!Number.isFinite(parcelas) || parcelas < 1) {
    return 1;
  }

  return Math.min(3, parcelas);
}

function normalizarTipoCartao(valor) {
  const tipo = String(valor || '').trim().toLowerCase();
  if (['debito', 'debit', 'debit_card'].includes(tipo)) {
    return 'debito';
  }

  return 'credito';
}

function normalizarAuthenticationMethodType(valor) {
  const type = String(valor || '').trim().toUpperCase();
  if (!type) {
    return '';
  }

  if (['THREEDS', '3DS', 'THREE_DS', 'THREE-DS'].includes(type)) {
    return 'THREEDS';
  }

  return type;
}

function normalizarStatusAutenticacao3DSPagBank(valor) {
  return String(valor || '').trim().toUpperCase();
}

function extrairIdAutenticacao3DSPagBank(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return '';
  }

  return String(
    valor.id
      || valor.authentication_id
      || valor.authenticationId
      || valor.three_ds_id
      || ''
  ).trim();
}

function extrairTraceIdAutenticacao3DSPagBank(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
    return '';
  }

  return String(
    valor.trace_id
      || valor.traceId
      || valor.request_id
      || valor.requestId
      || valor.transaction_id
      || ''
  ).trim();
}

function validarResultadoAutenticacao3DSPagBank({
  threeDSResult,
  authenticationMethod
} = {}) {
  const resultado = (threeDSResult && typeof threeDSResult === 'object' && !Array.isArray(threeDSResult))
    ? threeDSResult
    : null;
  const status = normalizarStatusAutenticacao3DSPagBank(
    resultado?.status
      || resultado?.three_ds_status
      || resultado?.result
  );
  const authIdResultado = extrairIdAutenticacao3DSPagBank(resultado);
  const authIdMetodo = String(authenticationMethod?.id || '').trim();
  const traceId = extrairTraceIdAutenticacao3DSPagBank(resultado);
  const authenticationId = authIdResultado || authIdMetodo;

  if (!status) {
    return {
      ok: false,
      codigo: 'MISSING_3DS_STATUS',
      status,
      authenticationId,
      traceId,
      mensagem: 'Resultado 3DS ausente para pagamento no debito.'
    };
  }

  if (status === 'AUTH_FLOW_COMPLETED') {
    if (!authenticationId) {
      return {
        ok: false,
        codigo: 'MISSING_3DS_AUTH_ID',
        status,
        authenticationId,
        traceId,
        mensagem: 'Autenticacao 3DS concluida sem id valido.'
      };
    }

    if (authIdResultado && authIdMetodo && authIdResultado !== authIdMetodo) {
      return {
        ok: false,
        codigo: '3DS_AUTH_ID_MISMATCH',
        status,
        authenticationId,
        traceId,
        mensagem: 'Id 3DS do resultado difere do authentication_method enviado.'
      };
    }

    return {
      ok: true,
      codigo: 'AUTH_FLOW_COMPLETED',
      status,
      authenticationId,
      traceId,
      mensagem: 'Autenticacao 3DS validada com sucesso.'
    };
  }

  if (status === 'AUTH_NOT_SUPPORTED') {
    return {
      ok: false,
      codigo: 'AUTH_NOT_SUPPORTED',
      status,
      authenticationId,
      traceId,
      mensagem: 'Cartao nao elegivel para autenticacao 3DS no debito.'
    };
  }

  if (status === 'CHANGE_PAYMENT_METHOD') {
    return {
      ok: false,
      codigo: 'CHANGE_PAYMENT_METHOD',
      status,
      authenticationId,
      traceId,
      mensagem: 'PagBank solicitou troca de meio de pagamento apos 3DS.'
    };
  }

  if (status === 'REQUIRE_CHALLENGE') {
    return {
      ok: false,
      codigo: 'REQUIRE_CHALLENGE',
      status,
      authenticationId,
      traceId,
      mensagem: 'Desafio 3DS ainda pendente para o debito.'
    };
  }

  return {
    ok: false,
    codigo: 'INVALID_3DS_STATUS',
    status,
    authenticationId,
    traceId,
    mensagem: `Status 3DS nao suportado para debito: ${status || 'vazio'}.`
  };
}

function normalizarAuthenticationMethodPagBank(valor) {
  if (!valor) {
    return null;
  }

  if (typeof valor === 'string') {
    const id = String(valor).trim();
    if (!id) {
      return null;
    }

    return {
      type: 'THREEDS',
      id
    };
  }

  if (typeof valor !== 'object' || Array.isArray(valor)) {
    return null;
  }

  const origem = (valor.authentication_method && typeof valor.authentication_method === 'object')
    ? valor.authentication_method
    : valor;
  const type = normalizarAuthenticationMethodType(
    origem.type
      || origem.authentication_type
      || origem.method_type
  );
  const id = String(
    origem.id
      || origem.authentication_id
      || origem.authenticationId
      || origem.value
      || ''
  ).trim();

  if (!type && !id) {
    return null;
  }

  return {
    ...(type ? { type } : {}),
    ...(id ? { id } : {})
  };
}

function validarAuthenticationMethodPagBank(valor) {
  const auth = normalizarAuthenticationMethodPagBank(valor);
  if (!auth) {
    return {
      ok: false,
      motivo: 'missing',
      auth: null,
      modo: 'none'
    };
  }

  if (auth.type !== 'THREEDS') {
    return {
      ok: false,
      motivo: 'invalid_type',
      auth,
      modo: 'invalid_type'
    };
  }

  if (!String(auth.id || '').trim()) {
    return {
      ok: false,
      motivo: 'missing_id',
      auth,
      modo: 'missing_id'
    };
  }

  return {
    ok: true,
    motivo: 'ok',
    auth: {
      type: 'THREEDS',
      id: String(auth.id).trim()
    },
    modo: 'threeds_internal'
  };
}

function montarAuthenticationMethodMock3DS() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10).toUpperCase();

  return {
    type: 'THREEDS',
    id: `3DS_MOCK_${timestamp}_${random}`
  };
}

module.exports = {
  normalizarParcelasCartao,
  normalizarTipoCartao,
  normalizarAuthenticationMethodPagBank,
  validarAuthenticationMethodPagBank,
  montarAuthenticationMethodMock3DS,
  validarResultadoAutenticacao3DSPagBank
};
