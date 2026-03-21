import React from 'react';
import { getPlaceholderIconePorCategoria } from '../../lib/produtosUtils';

export const ProdutoImageFallback = React.memo(function ProdutoImageFallback({ produto }) {
  return (
    <div className="produto-image-fallback" role="img" aria-label="Foto do produto">
      <span className="produto-image-fallback-icon" aria-hidden="true">
        {getPlaceholderIconePorCategoria(produto)}
      </span>
      <span className="produto-image-fallback-text">Foto em breve</span>
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
