import purgecss from '@fullhuman/postcss-purgecss';

/**
 * PostCSS config — usado somente em build de produção para remover CSS não utilizado.
 *
 * Safelist: classes geradas dinamicamente (template literals, join(), condicionais)
 * que o PurgeCSS não consegue detectar via análise estática.
 */

const isProduction = process.env.NODE_ENV === 'production';

const plugins = [];

if (isProduction) {
  plugins.push(
    purgecss({
      content: [
        './index.html',
        './src/**/*.{jsx,js,ts,tsx}',
      ],
      defaultExtractor: (content) => content.match(/[\w-/:[\]#.]+(?<!:)/g) || [],
      safelist: {
        // Classes de tone/estado geradas dinamicamente
        standard: [
          /^is-/,
          /^has-/,
          /^btn-/,
          /^card-/,
          /^page/,
          /^checkout-/,
          /^delivery-/,
          /^payment-/,
          /^cart-/,
          /^pix-/,
          /^admin-/,
          /^status-/,
          /^error-/,
          /^muted-/,
          /^growth-/,
        ],
        // Classes com variáveis interpoladas que não podem ser detectadas estaticamente
        deep: [
          /^checkout-stage-/,
          /^checkout-cart-/,
          /^checkout-delivery-/,
          /^checkout-payment-/,
          /^checkout-revisao-/,
          /^checkout-client-review-/,
          /^checkout-pix-/,
          /^checkout-inline-/,
          /^checkout-stepper-/,
          /^delivery-mode-/,
          /^payment-method-/,
          /^pix-status-/,
          /^payment-readiness-/,
          /^payment-action-/,
          /^order-summary-/,
          /^cart-item-/,
        ],
      },
    })
  );
}

export default { plugins };
