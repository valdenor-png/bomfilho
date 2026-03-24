'use strict';

/**
 * Cria a função verificarCredencialPagBank com estado encapsulado.
 *
 * @param {object} deps
 * @param {string} deps.PAGBANK_TOKEN
 * @param {string} deps.PAGBANK_API_URL
 * @param {Function} deps.enviarPostPagBankOrders
 * @returns {{ verificarCredencialPagBank: Function, getLastAuthCheck: Function }}
 */
function criarDiagnosticoPagBank(deps) {
  const {
    PAGBANK_TOKEN,
    PAGBANK_API_URL,
    enviarPostPagBankOrders
  } = deps;

  const fetch = global.fetch;
  let pagbankLastAuthCheck = null;

  async function verificarCredencialPagBank() {
    if (!PAGBANK_TOKEN) {
      pagbankLastAuthCheck = {
        checkedAt: new Date().toISOString(),
        ok: false,
        status: 'missing_token',
        httpStatus: null,
        message: 'PAGBANK_TOKEN ausente'
      };
      return pagbankLastAuthCheck;
    }

    const headers = {
      'Authorization': `Bearer ${PAGBANK_TOKEN}`,
      'Content-Type': 'application/json'
    };

    // 1) Tenta um GET sem efeitos colaterais.
    try {
      const respGet = await fetch(`${PAGBANK_API_URL}/orders`, { method: 'GET', headers });
      if (respGet.ok) {
        pagbankLastAuthCheck = {
          checkedAt: new Date().toISOString(),
          ok: true,
          status: 'ok',
          httpStatus: respGet.status,
          message: 'Credencial válida (GET /orders)'
        };
        return pagbankLastAuthCheck;
      }

      if (respGet.status === 401) {
        const text = await respGet.text();
        pagbankLastAuthCheck = {
          checkedAt: new Date().toISOString(),
          ok: false,
          status: 'unauthorized',
          httpStatus: respGet.status,
          message: text || 'UNAUTHORIZED'
        };
        return pagbankLastAuthCheck;
      }
    } catch (_e) {
      // Ignora e tenta fallback
    }

    // 2) Fallback: POST inválido, esperando 400 (token ok) ou 401 (token inválido)
    try {
      const payloadDiagnostico = {
        reference_id: `diag_auth_${Date.now()}`,
        customer: {
          name: 'Diagnostico Auth',
          email: 'diagnostico@example.com',
          tax_id: '12345678909'
        },
        items: []
      };

      const { response: respPost, responseBodyText } = await enviarPostPagBankOrders({
        headers,
        payload: payloadDiagnostico
      });
      const text = responseBodyText;

      if (respPost.status === 401) {
        pagbankLastAuthCheck = {
          checkedAt: new Date().toISOString(),
          ok: false,
          status: 'unauthorized',
          httpStatus: respPost.status,
          message: text || 'UNAUTHORIZED'
        };
        return pagbankLastAuthCheck;
      }

      if (respPost.status === 400) {
        pagbankLastAuthCheck = {
          checkedAt: new Date().toISOString(),
          ok: true,
          status: 'ok',
          httpStatus: respPost.status,
          message: 'Credencial parece válida (POST /orders retornou 400 por payload inválido)'
        };
        return pagbankLastAuthCheck;
      }

      pagbankLastAuthCheck = {
        checkedAt: new Date().toISOString(),
        ok: respPost.ok,
        status: respPost.ok ? 'ok' : 'unknown',
        httpStatus: respPost.status,
        message: text || `Resposta inesperada (${respPost.status})`
      };
      return pagbankLastAuthCheck;
    } catch (e) {
      pagbankLastAuthCheck = {
        checkedAt: new Date().toISOString(),
        ok: false,
        status: 'network_error',
        httpStatus: null,
        message: e?.message || 'Erro de rede'
      };
      return pagbankLastAuthCheck;
    }
  }

  function getLastAuthCheck() {
    return pagbankLastAuthCheck;
  }

  return { verificarCredencialPagBank, getLastAuthCheck };
}

module.exports = { criarDiagnosticoPagBank };
