import { useEffect } from 'react';

const DEFAULT_TITLE = 'BomFilho Supermercado';
const DEFAULT_DESCRIPTION = 'Supermercado online BomFilho — ofertas reais, entrega rápida e compra simples pelo celular.';

function getOrCreateMeta(attr, value) {
  let el = document.querySelector(`meta[${attr}="${value}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  return el;
}

function getOrCreateLink(rel) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Hook leve para controlar <title>, meta description, Open Graph e canonical.
 *
 * Uso:
 *   useDocumentHead({ title: 'Produtos', description: '...' });
 *   useDocumentHead({ title: 'Sobre' });
 */
export default function useDocumentHead({ title, description, ogImage } = {}) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} | ${DEFAULT_TITLE}`
      : DEFAULT_TITLE;
    const desc = description || DEFAULT_DESCRIPTION;

    document.title = fullTitle;

    getOrCreateMeta('name', 'description').setAttribute('content', desc);
    getOrCreateMeta('property', 'og:title').setAttribute('content', fullTitle);
    getOrCreateMeta('property', 'og:description').setAttribute('content', desc);
    getOrCreateMeta('property', 'og:type').setAttribute('content', 'website');

    if (ogImage) {
      getOrCreateMeta('property', 'og:image').setAttribute('content', ogImage);
    }

    const canonical = getOrCreateLink('canonical');
    canonical.setAttribute('href', window.location.origin + window.location.pathname);

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, ogImage]);
}
