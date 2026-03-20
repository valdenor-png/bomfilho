import React from 'react';
import SmartImage from '../ui/SmartImage';
import {
  CATEGORY_IMAGES,
  formatCurrency,
  getProdutoImagem,
  getProdutoImagemBlurSrc,
  getProdutoNome,
  normalizeText
} from '../../lib/produtosUtils';

const RecorrenciaMiniCard = React.memo(function RecorrenciaMiniCard({
  produto,
  favorito,
  onAbrir,
  onAdicionar,
  onAlternarFavorito,
  destaqueRecompra = false
}) {
  const nome = getProdutoNome(produto);
  const imagem = getProdutoImagem(produto) || CATEGORY_IMAGES[normalizeText(produto?.categoria)] || '/img/logo-oficial.png';
  const blurSrc = getProdutoImagemBlurSrc(produto);
  const preco = formatCurrency(Number(produto?.preco || 0));

  return (
    <article className={`recorrencia-mini-card ${destaqueRecompra ? 'is-recompra' : ''}`.trim()}>
      <button
        type="button"
        className={`recorrencia-favorite-btn ${favorito ? 'is-active' : ''}`}
        onClick={() => onAlternarFavorito(produto)}
        aria-label={favorito ? `Remover ${nome} dos favoritos` : `Salvar ${nome} nos favoritos`}
      >
        {favorito ? '♥' : '♡'}
      </button>

      <button
        type="button"
        className="recorrencia-mini-media"
        onClick={() => onAbrir(produto)}
        aria-label={`Abrir ${nome}`}
      >
        <SmartImage
          src={imagem}
          blurSrc={blurSrc}
          alt={nome}
          loading="lazy"
          fallbackSrc="/img/logo-oficial.png"
        />
      </button>

      <div className="recorrencia-mini-body">
        <p className="recorrencia-mini-name" title={nome}>{nome}</p>
        <p className="recorrencia-mini-price">{preco}</p>
      </div>

      <button
        type="button"
        className={`btn-secondary recorrencia-mini-add ${destaqueRecompra ? 'is-recompra' : ''}`.trim()}
        onClick={() => onAdicionar(produto)}
      >
        Comprar novamente • {preco}
      </button>
    </article>
  );
});

RecorrenciaMiniCard.displayName = 'RecorrenciaMiniCard';

export default RecorrenciaMiniCard;
