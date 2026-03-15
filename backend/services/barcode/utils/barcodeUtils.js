'use strict';

const GTIN_TAMANHOS_VALIDOS = new Set([8, 12, 13, 14]);

function normalizarBarcode(valor, { maxLength = 32 } = {}) {
  const limite = Number.isFinite(Number(maxLength)) && Number(maxLength) > 0
    ? Math.trunc(Number(maxLength))
    : 32;

  return String(valor || '').replace(/\D/g, '').slice(0, limite);
}

function calcularDigitoVerificadorGtin(codigoSemDigito) {
  const body = String(codigoSemDigito || '').replace(/\D/g, '');
  if (!body) {
    return null;
  }

  let soma = 0;
  let peso = 3;

  for (let i = body.length - 1; i >= 0; i -= 1) {
    soma += Number(body[i]) * peso;
    peso = peso === 3 ? 1 : 3;
  }

  return (10 - (soma % 10)) % 10;
}

function detectarTipoBarcode(codigoNormalizado) {
  const codigo = String(codigoNormalizado || '').replace(/\D/g, '');
  switch (codigo.length) {
    case 8:
      return 'EAN-8';
    case 12:
      return 'UPC-A';
    case 13:
      return 'EAN-13';
    case 14:
      return 'GTIN-14';
    default:
      return 'DESCONHECIDO';
  }
}

function validarBarcode(valor) {
  const codigo = normalizarBarcode(valor);

  if (!codigo) {
    return {
      ok: false,
      normalized: '',
      reason: 'sem_barcode',
      message: 'Produto sem codigo de barras para consulta.',
      type: 'DESCONHECIDO'
    };
  }

  if (!GTIN_TAMANHOS_VALIDOS.has(codigo.length)) {
    return {
      ok: false,
      normalized: codigo,
      reason: 'barcode_invalido',
      message: 'Codigo de barras invalido. Tamanho nao suportado para EAN/GTIN.',
      type: detectarTipoBarcode(codigo)
    };
  }

  const corpo = codigo.slice(0, -1);
  const digitoInformado = Number(codigo.slice(-1));
  const digitoEsperado = calcularDigitoVerificadorGtin(corpo);

  if (!Number.isFinite(digitoEsperado) || digitoEsperado !== digitoInformado) {
    return {
      ok: false,
      normalized: codigo,
      reason: 'barcode_invalido',
      message: 'Codigo de barras invalido. Digito verificador inconsistente.',
      type: detectarTipoBarcode(codigo)
    };
  }

  return {
    ok: true,
    normalized: codigo,
    reason: '',
    message: '',
    type: detectarTipoBarcode(codigo)
  };
}

function isHttpImageUrl(url) {
  const valor = String(url || '').trim();
  if (!valor) {
    return false;
  }

  if (!/^https?:\/\//i.test(valor)) {
    return false;
  }

  if (/\s/.test(valor)) {
    return false;
  }

  return true;
}

module.exports = {
  normalizarBarcode,
  validarBarcode,
  detectarTipoBarcode,
  isHttpImageUrl
};