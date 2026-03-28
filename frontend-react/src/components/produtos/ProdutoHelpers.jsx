import React from 'react';
import { Package, ShoppingCart, Store, Wallet } from '../../icons';
import { getPlaceholderIconePorCategoria } from '../../lib/produtosUtils';

function resolveProdutoFallbackIcon(iconKey) {
  const key = String(iconKey || '').trim().toLowerCase();
  if (key === 'store') {
    return Store;
  }
  if (key === 'wallet') {
    return Wallet;
  }
  if (key === 'shopping-cart') {
    return ShoppingCart;
  }
  return Package;
}

export const ProdutoImageFallback = React.memo(function ProdutoImageFallback({ produto }) {
  const Icon = resolveProdutoFallbackIcon(getPlaceholderIconePorCategoria(produto));

  return (
    <div className="produto-image-fallback" role="img" aria-label="Foto do produto">
      <span className="produto-image-fallback-icon" aria-hidden="true">
        <Icon size={40} color="rgba(255,255,255,0.18)" />
      </span>
    </div>
  );
});

ProdutoImageFallback.displayName = 'ProdutoImageFallback';

export function ProdutoBadge({ tone, label }) {
  return <span className={`produto-badge produto-badge-${tone}`}>{label}</span>;
}

export function ProdutosSkeletonGrid({ quantidade = 10 }) {
  return (
    <div className="produto-grid produtos-skeleton-grid" aria-hidden="true">
      {Array.from({ length: quantidade }).map((_, index) => (
        <article className="produto-card produto-card-skeleton" key={`produto-skeleton-${index}`}>
          <div className="produto-skeleton-media" />
          <div className="produto-skeleton-line produto-skeleton-line-title" />
          <div className="produto-skeleton-line" />
          <div className="produto-skeleton-line produto-skeleton-line-price" />
          <div className="produto-skeleton-button" />
        </article>
      ))}
    </div>
  );
}
