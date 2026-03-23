import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SmartImage from '../ui/SmartImage';
import { ProdutoImageFallback, ProdutoBadge } from './ProdutoHelpers';
import {
  formatCurrency,
  getEstoqueBadge,
  getProdutoBadges,
  prefetchProductImage
} from '../../lib/produtosUtils';

const ProdutoCard = React.memo(function ProdutoCard({
  produtoIndexado,
  index = 0,
  isMobileViewport = false,
  nextImageSrc = '',
  estaAdicionando: estaAdicionandoExterno = false,
  quantidadeNoCarrinho,
  destaqueMaisVendido,
  destaqueNovo,
  destaqueConversao = false,
  favorito = false,
  sinalRecorrente = false,
  sinalRecomendado = false,
  growthExperimento = null,
  foiAdicionadoRecente = false,
  onAddItem,
  onIncreaseItem,
  onDecreaseItem,
  onToggleFavorito,
  onOpenDetail
}) {
  const produto = produtoIndexado.produto;
  const imagem = produtoIndexado.imagemResponsiva;
  const [imagemIndisponivel, setImagemIndisponivel] = useState(() => !imagem.src);
  const [adicionandoLocal, setAdicionandoLocal] = useState(false);
  const adicionandoTimerRef = useRef(null);

  const estaAdicionando = adicionandoLocal || estaAdicionandoExterno;

  useEffect(() => {
    return () => {
      if (adicionandoTimerRef.current) {
        clearTimeout(adicionandoTimerRef.current);
      }
    };
  }, []);

  const handleAddItemLocal = useCallback(() => {
    setAdicionandoLocal(true);
    onAddItem(produto);
    if (adicionandoTimerRef.current) {
      clearTimeout(adicionandoTimerRef.current);
    }
    adicionandoTimerRef.current = setTimeout(() => {
      setAdicionandoLocal(false);
      adicionandoTimerRef.current = null;
    }, 520);
  }, [onAddItem, produto]);

  const handleIncreaseLocal = useCallback(() => {
    setAdicionandoLocal(true);
    onIncreaseItem(produto);
    if (adicionandoTimerRef.current) {
      clearTimeout(adicionandoTimerRef.current);
    }
    adicionandoTimerRef.current = setTimeout(() => {
      setAdicionandoLocal(false);
      adicionandoTimerRef.current = null;
    }, 520);
  }, [onIncreaseItem, produto]);

  useEffect(() => {
    setImagemIndisponivel(!imagem.src);
  }, [imagem.src]);

  useEffect(() => {
    prefetchProductImage(nextImageSrc);
  }, [nextImageSrc]);

  const nomeProduto = produtoIndexado.nomeProduto;
  const categoriaLabel = produtoIndexado.categoriaLabel;
  const detalhesProduto = produtoIndexado.detalhesComerciais;
  const medidaProduto = produtoIndexado.medidaProduto;
  const precoInfo = produtoIndexado.precoInfo;
  const estoqueInfo = produtoIndexado.estoqueInfo;
  const estoqueBadge = useMemo(() => getEstoqueBadge(estoqueInfo), [estoqueInfo]);
  const growthCatalogConfig = growthExperimento?.catalog || null;
  const growthCatalogEnabled = Boolean(growthCatalogConfig?.enabled);
  const growthCatalogBadge = growthCatalogEnabled
    ? String(growthCatalogConfig?.badgeLabel || '').trim()
    : '';
  const growthCatalogPriceHighlight = growthCatalogEnabled
    ? String(growthCatalogConfig?.priceHighlight || 'none').trim() || 'none'
    : 'none';
  const growthCatalogHelper = growthCatalogEnabled
    ? String(growthCatalogConfig?.helperText || '').trim()
    : '';
  const badges = useMemo(() => getProdutoBadges(produtoIndexado, {
    destaqueMaisVendido,
    destaqueNovo,
    destaqueConversao,
    favorito,
    recorrente: sinalRecorrente,
    recomendado: sinalRecomendado,
    growthBadgeLabel: growthCatalogBadge
  }), [
    destaqueMaisVendido,
    destaqueNovo,
    destaqueConversao,
    favorito,
    growthCatalogBadge,
    sinalRecorrente,
    sinalRecomendado,
    produtoIndexado
  ]);
  const statusBadges = badges.filter(b => b.tone === 'mais-vendido' || b.tone === 'recomendado');
  const promoBadges = badges.filter(b => b.tone !== 'mais-vendido' && b.tone !== 'recomendado');
  const podeComprar = produtoIndexado.carrinhoId !== null;
  const shouldPrioritizeImage = isMobileViewport ? index < 1 : index < 2;
  const priceAreaClassName = [
    'produto-price-area',
    growthCatalogEnabled ? `is-growth-${growthCatalogPriceHighlight}` : ''
  ].filter(Boolean).join(' ');
  const priceClassName = [
    'produto-price',
    (growthCatalogEnabled && growthCatalogPriceHighlight !== 'none') ? 'is-growth-emphasis' : ''
  ].filter(Boolean).join(' ');
  const cardClassName = [
    'produto-card',
    foiAdicionadoRecente ? 'is-added' : '',
    quantidadeNoCarrinho > 0 ? 'has-qty' : '',
    (produtoIndexado.emPromocao || precoInfo.precoAnterior) ? 'is-offer' : '',
    (destaqueMaisVendido || sinalRecorrente) ? 'is-popular' : '',
    destaqueConversao ? 'is-conversion-winner' : ''
  ].filter(Boolean).join(' ');

  return (
    <article className={cardClassName}>
      <div className="produto-card-media">
        <button
          type="button"
          className={`produto-favorite-btn ${favorito ? 'is-active' : ''}`}
          onClick={() => onToggleFavorito(produto)}
          aria-label={favorito ? `Remover ${nomeProduto} dos favoritos` : `Salvar ${nomeProduto} nos favoritos`}
        >
          {favorito ? '♥' : '♡'}
        </button>

        {promoBadges.length > 0 ? (
          <div className="produto-badges" aria-label="Selos do produto">
            {promoBadges.map((badge) => (
              <ProdutoBadge key={`${badge.tone}:${badge.label}`} tone={badge.tone} label={badge.label} />
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="produto-media-button"
          onClick={() => onOpenDetail(produtoIndexado.chaveReact)}
          aria-label={`Ver detalhes de ${nomeProduto}`}
        >
          {imagemIndisponivel ? (
            <ProdutoImageFallback produto={produto} />
          ) : (
            <SmartImage
              className="produto-image"
              src={imagem.src}
              blurSrc={imagem.blurSrc}
              srcSet={imagem.srcSet}
              sizes={imagem.sizes}
              alt={nomeProduto}
              priority={shouldPrioritizeImage}
              loading="lazy"
              decoding="async"
              onError={() => {
                setImagemIndisponivel(true);
              }}
            />
          )}
        </button>

        {podeComprar ? (
          quantidadeNoCarrinho > 0 ? (
            <div className="produto-qty-overlay" aria-label={`Quantidade de ${nomeProduto} no carrinho`}>
              <button
                type="button"
                className="produto-qty-overlay-btn"
                onClick={() => onDecreaseItem(produto, quantidadeNoCarrinho)}
                aria-label={`Diminuir quantidade de ${nomeProduto}`}
                disabled={estaAdicionando}
              >
                {quantidadeNoCarrinho <= 1 ? '🗑' : '−'}
              </button>
              <span className="produto-qty-overlay-value">{quantidadeNoCarrinho}</span>
              <button
                type="button"
                className="produto-qty-overlay-btn"
                onClick={handleIncreaseLocal}
                aria-label={`Aumentar quantidade de ${nomeProduto}`}
                disabled={estaAdicionando}
              >
                +
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`produto-quick-add ${estaAdicionando ? 'is-loading' : ''}`.trim()}
              onClick={handleAddItemLocal}
              disabled={estaAdicionando}
              aria-label={`Adicionar ${nomeProduto} ao carrinho`}
            >
              +
            </button>
          )
        ) : null}
      </div>

      <div className="produto-card-body" onClick={() => onOpenDetail(produtoIndexado.chaveReact)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpenDetail(produtoIndexado.chaveReact); }}>
        <h3 className="produto-title" title={nomeProduto}>{nomeProduto}</h3>
        {detalhesProduto && detalhesProduto !== 'Unidade' && !detalhesProduto.startsWith('Sele') ? (
          <p className="produto-details">{detalhesProduto}</p>
        ) : null}

        {estoqueInfo?.informado ? (
          <p className={`produto-stock-badge ${estoqueBadge?.cor === 'green' ? 'is-green' : ''} ${estoqueBadge?.cor === 'yellow' ? 'is-yellow' : ''}`.trim()}>
            {estoqueBadge?.cor === 'yellow' ? 'Pouco estoque' : 'Em estoque'}
          </p>
        ) : null}

        <div className={priceAreaClassName}>
          {precoInfo.precoAnterior ? (
            <p className="produto-price-old">de {formatCurrency(precoInfo.precoAnterior)}</p>
          ) : null}
          <p className={priceClassName}>{formatCurrency(precoInfo.precoAtual)}</p>

          {medidaProduto && medidaProduto !== 'Unidade' ? (
            <p className="produto-price-unit">{medidaProduto}</p>
          ) : null}

          {precoInfo.economia > 0 ? (
            <p className="produto-price-saving">Economize {formatCurrency(precoInfo.economia)}</p>
          ) : null}
        </div>
      </div>

      {foiAdicionadoRecente ? (
        <p className="produto-card-feedback" role="status" aria-live="polite">
          Adicionado ✅
        </p>
      ) : null}
    </article>
  );
});

ProdutoCard.displayName = 'ProdutoCard';

export default ProdutoCard;
