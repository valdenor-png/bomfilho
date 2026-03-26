import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Heart } from '../../icons';
import SmartImage from '../ui/SmartImage';
import { ProdutoImageFallback, ProdutoBadge } from './ProdutoHelpers';
import {
  formatCurrency,
  getEstoqueBadge,
  getProdutoBadges,
  prefetchProductImage
} from '../../lib/produtosUtils';
import {
  calcularSubtotalPeso,
  formatPesoInputValue,
  formatPesoSelecionado,
  resolvePesoConfig,
  resolveUnidadeVenda,
  sanitizePesoGramas
} from '../../lib/produtoCatalogoRules';

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
  const nomeProduto = produtoIndexado.nomeProduto;
  const detalhesProduto = produtoIndexado.detalhesComerciais;
  const medidaProduto = produtoIndexado.medidaProduto;
  const precoInfo = produtoIndexado.precoInfo;
  const estoqueInfo = produtoIndexado.estoqueInfo;
  const unidadeVenda = produtoIndexado.unidadeVenda || resolveUnidadeVenda(produto);
  const produtoPeso = unidadeVenda === 'peso';
  const pesoConfig = produtoIndexado.pesoConfig || resolvePesoConfig(produto, unidadeVenda);
  const pesoMin = Number(pesoConfig?.peso_min_gramas || 100);
  const pesoStep = Number(pesoConfig?.peso_step_gramas || 50);
  const pesoPadrao = Number(pesoConfig?.peso_padrao_gramas || 500);

  const [imagemIndisponivel, setImagemIndisponivel] = useState(() => !imagem.src);
  const [adicionandoLocal, setAdicionandoLocal] = useState(false);
  const [pesoSelecionadoGramas, setPesoSelecionadoGramas] = useState(() => (
    produtoPeso ? sanitizePesoGramas(pesoPadrao, pesoConfig) : 0
  ));
  const adicionandoTimerRef = useRef(null);

  const estaAdicionando = adicionandoLocal || estaAdicionandoExterno;

  useEffect(() => {
    return () => {
      if (adicionandoTimerRef.current) {
        clearTimeout(adicionandoTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!produtoPeso) {
      setPesoSelecionadoGramas(0);
      return;
    }

    setPesoSelecionadoGramas(sanitizePesoGramas(pesoPadrao, pesoConfig));
  }, [pesoPadrao, pesoConfig, produtoPeso]);

  useEffect(() => {
    setImagemIndisponivel(!imagem.src);
  }, [imagem.src]);

  useEffect(() => {
    prefetchProductImage(nextImageSrc);
  }, [nextImageSrc]);

  const handlePesoChange = useCallback((pesoGramas) => {
    if (!produtoPeso) {
      return;
    }

    setPesoSelecionadoGramas(sanitizePesoGramas(pesoGramas, pesoConfig));
  }, [pesoConfig, produtoPeso]);

  const handlePesoInputChange = useCallback((event) => {
    const digits = String(event.target.value || '').replace(/\D/g, '');
    if (!digits) {
      handlePesoChange(pesoMin);
      return;
    }

    handlePesoChange(Number(digits));
  }, [handlePesoChange, pesoMin]);

  const handlePesoDecrease = useCallback(() => {
    handlePesoChange(Math.max(pesoMin, Number(pesoSelecionadoGramas || 0) - pesoStep));
  }, [handlePesoChange, pesoMin, pesoSelecionadoGramas, pesoStep]);

  const handlePesoIncrease = useCallback(() => {
    handlePesoChange(Number(pesoSelecionadoGramas || 0) + pesoStep);
  }, [handlePesoChange, pesoSelecionadoGramas, pesoStep]);

  const withTemporaryLoading = useCallback((action) => {
    setAdicionandoLocal(true);
    action();

    if (adicionandoTimerRef.current) {
      clearTimeout(adicionandoTimerRef.current);
    }

    adicionandoTimerRef.current = setTimeout(() => {
      setAdicionandoLocal(false);
      adicionandoTimerRef.current = null;
    }, 520);
  }, []);

  const handleAddItemLocal = useCallback(() => {
    withTemporaryLoading(() => {
      onAddItem(produto, produtoPeso
        ? {
          unidade_venda: 'peso',
          peso_gramas: pesoSelecionadoGramas
        }
        : {}
      );
    });
  }, [onAddItem, pesoSelecionadoGramas, produto, produtoPeso, withTemporaryLoading]);

  const handleIncreaseLocal = useCallback(() => {
    withTemporaryLoading(() => {
      onIncreaseItem(produto, produtoPeso
        ? {
          unidade_venda: 'peso',
          peso_gramas: pesoSelecionadoGramas
        }
        : {}
      );
    });
  }, [onIncreaseItem, pesoSelecionadoGramas, produto, produtoPeso, withTemporaryLoading]);

  const totalPesoSelecionado = useMemo(() => {
    if (!produtoPeso) {
      return 0;
    }

    return calcularSubtotalPeso(precoInfo.precoAtual, pesoSelecionadoGramas, 1);
  }, [precoInfo.precoAtual, produtoPeso, pesoSelecionadoGramas]);

  const estoqueBadge = useMemo(() => getEstoqueBadge(estoqueInfo), [estoqueInfo]);
  const growthCatalogConfig = growthExperimento?.catalog || null;
  const growthCatalogEnabled = Boolean(growthCatalogConfig?.enabled);
  const growthCatalogBadge = growthCatalogEnabled
    ? String(growthCatalogConfig?.badgeLabel || '').trim()
    : '';
  const growthCatalogPriceHighlight = growthCatalogEnabled
    ? String(growthCatalogConfig?.priceHighlight || 'none').trim() || 'none'
    : 'none';

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

  const promoBadges = badges.filter((badge) => badge.tone !== 'mais-vendido' && badge.tone !== 'recomendado');
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
    destaqueConversao ? 'is-conversion-winner' : '',
    produtoPeso ? 'is-weight-product' : ''
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
          <Heart size={16} aria-hidden="true" fill={favorito ? 'currentColor' : 'none'} />
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
          produtoPeso ? (
            <button
              type="button"
              className={`produto-quick-add ${estaAdicionando ? 'is-loading' : ''}`.trim()}
              onClick={handleAddItemLocal}
              disabled={estaAdicionando}
              aria-label={`Adicionar ${nomeProduto} ao carrinho`}
            >
              +
            </button>
          ) : quantidadeNoCarrinho > 0 ? (
            <div className="produto-qty-overlay" aria-label={`Quantidade de ${nomeProduto} no carrinho`}>
              <button
                type="button"
                className="produto-qty-overlay-btn"
                onClick={() => onDecreaseItem(produto, quantidadeNoCarrinho)}
                aria-label={`Diminuir quantidade de ${nomeProduto}`}
                disabled={estaAdicionando}
              >
                {quantidadeNoCarrinho <= 1 ? 'x' : '-'}
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

      <div
        className="produto-card-body"
        onClick={() => onOpenDetail(produtoIndexado.chaveReact)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onOpenDetail(produtoIndexado.chaveReact);
          }
        }}
      >
        <h3 className="produto-title" title={nomeProduto}>{nomeProduto}</h3>

        {detalhesProduto && detalhesProduto !== 'Unidade' && !detalhesProduto.startsWith('Sele') ? (
          <p className="produto-details">{detalhesProduto}</p>
        ) : null}

        {estoqueInfo?.informado ? (
          <p className={`produto-stock-badge ${estoqueBadge?.cor === 'green' ? 'is-green' : ''} ${estoqueBadge?.cor === 'yellow' ? 'is-yellow' : ''}`.trim()}>
            {estoqueBadge?.cor === 'yellow' ? 'Pouco estoque' : 'Em estoque'}
          </p>
        ) : null}

        {produtoPeso ? (
          <div
            className="produto-weight-control"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <p className="produto-weight-label">Quantidade</p>
            <div className="produto-weight-input-row">
              <button
                type="button"
                className="produto-weight-btn"
                onClick={handlePesoDecrease}
                aria-label={`Diminuir gramagem de ${nomeProduto}`}
                disabled={estaAdicionando || pesoSelecionadoGramas <= pesoMin}
              >
                -
              </button>

              <input
                type="number"
                min={pesoMin}
                step={pesoStep}
                inputMode="numeric"
                className="produto-weight-input"
                value={formatPesoInputValue(pesoSelecionadoGramas)}
                onChange={handlePesoInputChange}
                aria-label={`Peso em gramas para ${nomeProduto}`}
              />

              <button
                type="button"
                className="produto-weight-btn"
                onClick={handlePesoIncrease}
                aria-label={`Aumentar gramagem de ${nomeProduto}`}
                disabled={estaAdicionando}
              >
                +
              </button>
            </div>

            <p className="produto-weight-selected">{formatPesoSelecionado(pesoSelecionadoGramas)}</p>
          </div>
        ) : null}

        <div className={priceAreaClassName}>
          {precoInfo.precoAnterior ? (
            <p className="produto-price-old">de {formatCurrency(precoInfo.precoAnterior)}</p>
          ) : null}

          <p className={priceClassName}>
            {formatCurrency(precoInfo.precoAtual)}
            {produtoPeso ? <span className="produto-price-per-kg">/kg</span> : null}
          </p>

          {produtoPeso ? (
            <p className="produto-weight-total">
              {formatPesoSelecionado(pesoSelecionadoGramas)}: {formatCurrency(totalPesoSelecionado)}
            </p>
          ) : (
            medidaProduto && medidaProduto !== 'Unidade' ? (
              <p className="produto-price-unit">{medidaProduto}</p>
            ) : null
          )}

          {precoInfo.economia > 0 ? (
            <p className="produto-price-saving">Economize {formatCurrency(precoInfo.economia)}</p>
          ) : null}
        </div>

        {produtoPeso && quantidadeNoCarrinho > 0 ? (
          <p className="produto-weight-cart-hint">{quantidadeNoCarrinho} no carrinho</p>
        ) : null}
      </div>

      {foiAdicionadoRecente ? (
        <p className="produto-card-feedback" role="status" aria-live="polite">
          Adicionado
        </p>
      ) : null}
    </article>
  );
});

ProdutoCard.displayName = 'ProdutoCard';

export default ProdutoCard;
