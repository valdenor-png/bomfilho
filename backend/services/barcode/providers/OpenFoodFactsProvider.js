'use strict';

const ProductCatalogProvider = require('./ProductCatalogProvider');

class OpenFoodFactsProvider extends ProductCatalogProvider {
  constructor(options = {}) {
    super({
      providerName: 'openfoodfacts',
      timeoutMs: options.timeoutMs
    });

    this.baseUrl = String(options.baseUrl || 'https://world.openfoodfacts.org').replace(/\/+$/, '');
    this.userAgent = String(options.userAgent || 'BomFilhoAdmin/1.0').trim() || 'BomFilhoAdmin/1.0';
  }

  async lookup(barcode) {
    const codigo = this.normalizeBarcode(barcode);
    if (!codigo) {
      return this.createNotFoundResult('Codigo de barras invalido.');
    }

    const url = `${this.baseUrl}/api/v2/product/${codigo}.json`;

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return this.createNotFoundResult('Produto nao encontrado no OpenFoodFacts.');
        }
        return this.createErrorResult(`OpenFoodFacts retornou status ${response.status}.`);
      }

      const payload = await response.json().catch(() => null);
      const product = payload?.product;

      if (!product || Number(payload?.status || 0) !== 1) {
        return this.createNotFoundResult('Produto nao encontrado no OpenFoodFacts.');
      }

      return this.createFoundResult(
        {
          nome: product.product_name_pt || product.product_name || product.generic_name,
          marca: product.brands || (Array.isArray(product.brands_tags) ? product.brands_tags[0] : ''),
          descricao: product.ingredients_text_pt || product.ingredients_text || product.quantity,
          imagem: product.image_front_url || product.image_url
        },
        {
          source: 'openfoodfacts',
          code: codigo,
          tags_count: Array.isArray(product.categories_tags) ? product.categories_tags.length : 0
        }
      );
    } catch (error) {
      if (error?.name === 'AbortError') {
        return this.createErrorResult('Timeout ao consultar OpenFoodFacts.');
      }

      return this.createErrorResult('Falha de rede ao consultar OpenFoodFacts.');
    }
  }
}

module.exports = OpenFoodFactsProvider;
