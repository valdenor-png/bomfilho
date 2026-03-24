'use strict';

class ProductCatalogProvider {
  constructor({
    providerName,
    timeoutMs = 4500
  } = {}) {
    this.providerName = String(providerName || 'provider').trim().toLowerCase();
    this.timeoutMs = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
      ? Number(timeoutMs)
      : 4500;
  }

  normalizeBarcode(barcode) {
    const digits = String(barcode || '').replace(/\D/g, '');
    if (!digits) {
      return '';
    }
    return digits.slice(0, 32);
  }

  normalizeText(value, maxLength = 1200) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }

    if (text.length <= maxLength) {
      return text;
    }

    return text.slice(0, maxLength).trim();
  }

  isHttpUrl(url) {
    const value = String(url || '').trim();
    return /^https?:\/\//i.test(value);
  }

  extractMelhorImagem(payload = {}) {
    const candidatos = [
      payload.imagem,
      payload.image,
      payload.imageUrl,
      payload.image_url,
      payload.thumbnail,
      payload.photo,
      Array.isArray(payload.images) ? payload.images[0] : '',
      Array.isArray(payload.pictures) ? payload.pictures[0] : ''
    ];

    for (const candidato of candidatos) {
      const valor = String(candidato || '').trim();
      if (valor && this.isHttpUrl(valor)) {
        return valor;
      }
    }

    return '';
  }

  normalizePayload(payload = {}) {
    const nome = this.normalizeText(payload.nome || payload.name, 255);
    const marca = this.normalizeText(payload.marca || payload.brand || payload.manufacturer, 120);
    const descricao = this.normalizeText(payload.descricao || payload.description, 1200);
    const imagem = this.extractMelhorImagem(payload);

    return {
      nome,
      marca,
      descricao,
      imagem
    };
  }

  createFoundResult(data = {}, payloadSummary = null) {
    const produto = this.normalizePayload(data);
    const temConteudo = Boolean(produto.nome || produto.descricao || produto.imagem);

    if (!temConteudo) {
      return {
        provider: this.providerName,
        found: false,
        status: 'not_found',
        message: 'Dados vazios para este codigo de barras.'
      };
    }

    return {
      provider: this.providerName,
      found: true,
      status: 'found',
      produto,
      payloadSummary: payloadSummary || null
    };
  }

  createNotFoundResult(message) {
    return {
      provider: this.providerName,
      found: false,
      status: 'not_found',
      message: String(message || 'Produto nao encontrado no provider.')
    };
  }

  createErrorResult(message) {
    return {
      provider: this.providerName,
      found: false,
      status: 'error',
      message: String(message || 'Falha ao consultar provider externo.')
    };
  }

  async fetchWithTimeout(url, options = {}) {
    const fetchImpl = global.fetch;
    if (typeof AbortController === 'undefined') {
      return fetchImpl(url, options);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      return await fetchImpl(url, {
        ...options,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async lookup(barcode) {
    const codigo = this.normalizeBarcode(barcode);
    if (!codigo) {
      return this.createNotFoundResult('Codigo de barras invalido.');
    }

    throw new Error(`Provider ${this.providerName} nao implementou lookup().`);
  }
}

module.exports = ProductCatalogProvider;
