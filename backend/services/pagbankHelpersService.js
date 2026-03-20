'use strict';

const logger = require('../lib/logger');

/**
 * Monta a URL do webhook PagBank.
 *
 * @param {object} opts
 * @param {string} opts.BASE_URL_ENV
 * @param {string} opts.PAGBANK_WEBHOOK_TOKEN
 * @returns {Function}
 */
function montarWebhookPagBankUrlFactory({ BASE_URL_ENV, PAGBANK_WEBHOOK_TOKEN }) {
  return function montarWebhookPagBankUrl({ incluirToken = true } = {}) {
    const baseUrl = String(BASE_URL_ENV || 'http://localhost:3000').replace(/\/+$/, '');
    const webhookBase = `${baseUrl}/api/webhooks/pagbank`;

    if (incluirToken && PAGBANK_WEBHOOK_TOKEN) {
      return `${webhookBase}?token=${encodeURIComponent(PAGBANK_WEBHOOK_TOKEN)}`;
    }

    return webhookBase;
  };
}

/**
 * Analisa e valida PAGBANK_PUBLIC_KEY.
 *
 * @param {string} [publicKeyOverride] - Chave a analisar. Se omitido, usa env/config.
 * @param {string} [PAGBANK_PUBLIC_KEY] - Valor do config para fallback.
 * @returns {{ valid: boolean, reason: string, publicKey: string }}
 */
function analisarChavePublicaPagBank(publicKeyOverride, PAGBANK_PUBLIC_KEY) {
  const chaveBruta = String(publicKeyOverride || process.env.PAGBANK_PUBLIC_KEY || PAGBANK_PUBLIC_KEY || '').trim();
  if (!chaveBruta) {
    return { valid: false, reason: 'missing', publicKey: '' };
  }

  const chaveNormalizada = chaveBruta
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n')
    .trim();

  if (!chaveNormalizada) {
    return { valid: false, reason: 'empty_after_normalize', publicKey: '' };
  }

  if (chaveNormalizada.includes('...')) {
    return { valid: false, reason: 'placeholder_or_truncated', publicKey: chaveNormalizada };
  }

  const hasPemHeader = /-----BEGIN PUBLIC KEY-----/.test(chaveNormalizada);
  const hasPemFooter = /-----END PUBLIC KEY-----/.test(chaveNormalizada);

  if (hasPemHeader !== hasPemFooter) {
    return { valid: false, reason: 'malformed_pem_header_footer', publicKey: chaveNormalizada };
  }

  const base64Body = (hasPemHeader || hasPemFooter)
    ? chaveNormalizada
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/\s+/g, '')
    : chaveNormalizada.replace(/\s+/g, '');

  if (!base64Body) {
    return { valid: false, reason: 'empty_base64_body', publicKey: chaveNormalizada };
  }

  if (!/^[A-Za-z0-9+/=]+$/.test(base64Body)) {
    return { valid: false, reason: 'invalid_base64_characters', publicKey: chaveNormalizada };
  }

  if (base64Body.length < 300) {
    return { valid: false, reason: 'base64_too_short', publicKey: chaveNormalizada };
  }

  return { valid: true, reason: 'ok', publicKey: chaveNormalizada };
}

/**
 * Traduz o motivo da análise de chave pública PagBank.
 */
function traduzirMotivoChavePublicaPagBank(reason) {
  const motivo = String(reason || '').trim().toLowerCase();

  if (motivo === 'missing') return 'PAGBANK_PUBLIC_KEY ausente';
  if (motivo === 'empty_after_normalize') return 'PAGBANK_PUBLIC_KEY vazia após normalização';
  if (motivo === 'placeholder_or_truncated') return 'PAGBANK_PUBLIC_KEY truncada/placeholder (contém "...")';
  if (motivo === 'malformed_pem_header_footer') return 'PAGBANK_PUBLIC_KEY com PEM malformado (BEGIN/END inconsistentes)';
  if (motivo === 'empty_base64_body') return 'PAGBANK_PUBLIC_KEY sem conteúdo base64';
  if (motivo === 'invalid_base64_characters') return 'PAGBANK_PUBLIC_KEY com caracteres inválidos';
  if (motivo === 'base64_too_short') return 'PAGBANK_PUBLIC_KEY curta demais (possível valor incompleto)';

  return 'PAGBANK_PUBLIC_KEY inválida';
}

/**
 * Registra logs de endpoints diagnóstico.
 */
function registrarLogEndpointDiagnostico({ endpoint, statusHttp, detalhe, extra } = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    endpoint: String(endpoint || ''),
    status_http: Number.isFinite(Number(statusHttp)) ? Number(statusHttp) : null,
    detalhe: detalhe ? String(detalhe) : undefined,
    extra
  };

  const status = Number(payload.status_http || 0);
  if (status >= 500) {
    logger.error('📍 API diagnóstico:', JSON.stringify(payload));
    return;
  }

  logger.info('📍 API diagnóstico:', JSON.stringify(payload));
}

module.exports = {
  montarWebhookPagBankUrlFactory,
  analisarChavePublicaPagBank,
  traduzirMotivoChavePublicaPagBank,
  registrarLogEndpointDiagnostico
};
