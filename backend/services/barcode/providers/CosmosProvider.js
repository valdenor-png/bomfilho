'use strict';

const ProductCatalogProvider = require('./ProductCatalogProvider');

function pickFirst(values = []) {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

class CosmosProvider extends ProductCatalogProvider {
  constructor(options = {}) {
    super({
      providerName: 'cosmos',
      timeoutMs: options.timeoutMs
    });

    this.baseUrl = String(options.baseUrl || 'https://api.cosmos.bluesoft.com.br').replace(/\/+$/, '');
    this.lookupPathTemplate = String(options.lookupPathTemplate || '/gtins/{barcode}').trim() || '/gtins/{barcode}';
    this.apiToken = String(options.apiToken || '').trim();
  }

  resolveLookupPath(barcode) {
    const path = this.lookupPathTemplate.includes('{barcode}')
      ? this.lookupPathTemplate.replace('{barcode}', barcode)
      : `${this.lookupPathTemplate.replace(/\/+$/, '')}/${barcode}`;

    return path.startsWith('/') ? path : `/${path}`;
  }

  async lookup(barcode) {
    const codigo = this.normalizeBarcode(barcode);
    if (!codigo) {
      return this.createNotFoundResult('Codigo de barras invalido.');
    }

    if (!this.apiToken) {
      return this.createNotFoundResult('Provider Cosmos sem token configurado.');
    }

    const url = `${this.baseUrl}${this.resolveLookupPath(codigo)}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'X-Cosmos-Token': this.apiToken,
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return this.createNotFoundResult('Produto nao encontrado no Cosmos.');
        }

        return this.createErrorResult(`Cosmos retornou status ${response.status}.`);
      }

      const payload = await response.json().catch(() => null);
      if (!payload || typeof payload !== 'object') {
        return this.createNotFoundResult('Cosmos retornou payload invalido.');
      }

      const item = payload.product || payload.item || payload;
      const nome = pickFirst([
        item?.description,
        item?.name,
        item?.nome,
        item?.title
      ]);
      const descricao = pickFirst([
        item?.description,
        item?.long_description,
        item?.full_description,
        item?.nome
      ]);
      const imagem = pickFirst([
        item?.thumbnail,
        item?.image,
        item?.image_url,
        item?.photo,
        item?.pictures?.[0],
        item?.images?.[0]
      ]);

      return this.createFoundResult(
        {
          nome,
          marca: item?.brand?.name || item?.brand || '',
          descricao,
          imagem
        },
        {
          source: 'cosmos',
          code: codigo,
          ncm: item?.ncm || null,
          brand: item?.brand?.name || item?.brand || null
        }
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        return this.createErrorResult('Timeout ao consultar Cosmos.');
      }

      return this.createErrorResult('Falha de rede ao consultar Cosmos.');
    }
  }
}

module.exports = CosmosProvider;
