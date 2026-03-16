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
  montarAuthenticationMethodMock3DS
};
