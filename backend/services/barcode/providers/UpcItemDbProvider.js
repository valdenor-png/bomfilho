'use strict';

const ProductCatalogProvider = require('./ProductCatalogProvider');

class UpcItemDbProvider extends ProductCatalogProvider {
  constructor(options = {}) {
    super({
      providerName: 'upcitemdb',
      timeoutMs: options.timeoutMs
    });

    this.baseUrl = String(options.baseUrl || 'https://api.upcitemdb.com').replace(/\/+$/, '');
    this.apiKey = String(options.apiKey || '').trim();
  }

  async lookup(barcode) {
    const codigo = this.normalizeBarcode(barcode);
    if (!codigo) {
      return this.createNotFoundResult('Codigo de barras invalido.');
    }

    const url = `${this.baseUrl}/prod/trial/lookup?upc=${codigo}`;
    const headers = {};

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    try {
      const response = await this.fetchWithTimeout(url, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          return this.createNotFoundResult('Produto nao encontrado no UPCItemDB.');
        }

        return this.createErrorResult(`UPCItemDB retornou status ${response.status}.`);
      }

      const payload = await response.json().catch(() => null);
      const item = Array.isArray(payload?.items) ? payload.items[0] : null;

      if (!item) {
        return this.createNotFoundResult('Produto nao encontrado no UPCItemDB.');
      }

      const imagem = Array.isArray(item.images) ? item.images[0] : '';

      return this.createFoundResult(
        {
          nome: item.title || item.description,
          marca: item.brand || item.brand_name || item.publisher || '',
          descricao: item.description || item.title,
          imagem
        },
        {
          source: 'upcitemdb',
          code: codigo,
          offers: Array.isArray(item.offers) ? item.offers.length : 0
        }
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        return this.createErrorResult('Timeout ao consultar UPCItemDB.');
      }

      return this.createErrorResult('Falha de rede ao consultar UPCItemDB.');
    }
  }
}

module.exports = UpcItemDbProvider;
