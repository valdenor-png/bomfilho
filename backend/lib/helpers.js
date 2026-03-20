'use strict';

const crypto = require('crypto');

/**
 * Cria um erro HTTP com status e mensagem.
 * @param {number} status
 * @param {string} mensagem
 * @returns {Error}
 */
function criarErroHttp(status, mensagem) {
  const erro = new Error(mensagem);
  erro.httpStatus = status;
  return erro;
}

function toLowerTrim(value) {
  return String(value || '').trim().toLowerCase();
}

function parsePositiveInt(value, fallback, { min = 1, max = 1000 } = {}) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

/** Arredonda valor monetário para 2 casas decimais usando centavos inteiros (evita erros de float). */
function toMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function parseBooleanInput(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'sim', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'nao', 'não', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseJsonObjectInput(rawValue, fallback = null) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return fallback;
  }

  if (typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return rawValue;
  }

  try {
    const parsed = JSON.parse(String(rawValue));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function parseOverwriteImageModeInput(value, fallback = 'if_empty') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['if_empty', 'only_if_empty', 'empty_only', 'preserve_existing', 'preservar_existente'].includes(normalized)) {
    return 'if_empty';
  }

  if (['always', 'overwrite', 'replace', 'sobrescrever'].includes(normalized)) {
    return 'always';
  }

  if (['never', 'keep', 'manter'].includes(normalized)) {
    return 'never';
  }

  return fallback;
}

function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, '\\$&');
}

function montarPaginacao(total, pagina, limite) {
  const totalSeguro = Number.isFinite(total) ? Math.max(0, total) : 0;
  const totalPaginas = totalSeguro > 0 ? Math.ceil(totalSeguro / limite) : 1;
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);
  const temMais = paginaAtual < totalPaginas;

  return {
    pagina: paginaAtual,
    limite,
    total: totalSeguro,
    total_paginas: totalPaginas,
    tem_mais: temMais
  };
}

function compararTextoSegura(valorA, valorB) {
  const bufferA = Buffer.from(String(valorA || ''));
  const bufferB = Buffer.from(String(valorB || ''));

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

module.exports = {
  criarErroHttp,
  toLowerTrim,
  parsePositiveInt,
  toMoney,
  parseBooleanInput,
  parseJsonObjectInput,
  parseOverwriteImageModeInput,
  escapeLike,
  montarPaginacao,
  compararTextoSegura
};
