import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SmartImage from '../ui/SmartImage';
import { ProdutoImageFallback, ProdutoBadge } from './ProdutoHelpers';
import {
  formatCurrency,
  getProdutoBadges,
  prefetchProductImage,
  getEstoqueBadge
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
  const podeComprar = produtoIndexado.carrinhoId !== null;
  const shouldPrioritizeImage = isMobileViewport ? index < 1 : index < 2;
  const urgenciaEstoqueAtiva = Boolean(podeComprar && estoqueInfo?.estoqueBaixo);
  const copyDisponibilidade = !podeComprar
    ? 'Indisponivel no momento'
    : (urgenciaEstoqueAtiva ? 'Restam poucas unidades' : '');
  const microcopyConversao = !podeComprar
    ? ''
    : (sinalRecorrente
      ? 'Baseado nas suas compras anteriores'
      : (growthCatalogHelper
        ? growthCatalogHelper
        : (urgenciaEstoqueAtiva
          ? 'Vale a pena levar agora'
          : (precoInfo.economia >= 1
            ? 'Economize hoje'
            : (destaqueMaisVendido ? 'Preco baixo de verdade' : 'Decisao rapida no carrinho')))));
  const precoCta = formatCurrency(precoInfo.precoAtual);
  const temPrecoNoCta = Number(precoInfo.precoAtual || 0) > 0;
  const ctaExperimentoCatalogo = !temPrecoNoCta || !growthCatalogEnabled
    ? ''
    : (growthCatalogConfig?.ctaMode === 'valor'
      ? `Levar agora • ${precoCta}`
      : (growthCatalogConfig?.ctaMode === 'urgencia' ? `Garantir hoje • ${precoCta}` : ''));
  const indicadorUrgencia = !podeComprar
    ? ''
    : (urgenciaEstoqueAtiva
      ? '⏳ Acabando'
      : (precoInfo.economia >= 1
        ? `💸 Economize ${formatCurrency(precoInfo.economia)}`
        : ((produtoIndexado.emPromocao || precoInfo.precoAnterior) ? '🔥 Oferta hoje' : '')));
  const ctaPrimaria = !podeComprar
    ? 'Indisponivel'
    : (estaAdicionando
      ? 'Adicionando...'
      : (temPrecoNoCta
        ? (quantidadeNoCarrinho > 0
          ? `Adicionar +1 • ${precoCta}`
          : (ctaExperimentoCatalogo
            || (precoInfo.precoAnterior ? `Levar por ${precoCta}` : `Adicionar agora • ${precoCta}`)))
        : 'Adicionar ao carrinho'));
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
    index === 0 ? 'is-prime' : '',
    indicadorUrgencia ? 'is-urgent' : '',
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

        {badges.length > 0 ? (
          <div className="produto-badges" aria-label="Selos do produto">
            {badges.map((badge) => (
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
          <button
            type="button"
            className={`produto-quick-add ${estaAdicionando ? 'is-loading' : ''}`.trim()}
            onClick={handleAddItemLocal}
            disabled={estaAdicionando}
            aria-label={`Adicionar ${nomeProduto} ao carrinho`}
          >
            +
          </button>
        ) : null}
      </div>

      <div className="produto-card-body">
        <p className="produto-category">
          {categoriaLabel}
        </p>
        <h3 className="produto-title" title={nomeProduto}>{nomeProduto}</h3>
        <p className="produto-details">{detalhesProduto}</p>
        {copyDisponibilidade ? (
          <p className={`produto-availability ${podeComprar ? 'is-available' : 'is-unavailable'} ${urgenciaEstoqueAtiva ? 'is-urgency' : ''}`.trim()}>
            {copyDisponibilidade}
          </p>
        ) : null}

        {(() => {
          const badge = getEstoqueBadge(estoqueInfo);
          return (
            <span className={`estoque-badge ${badge.classe}`}>{badge.label}</span>
          );
        })()}

        <div className={priceAreaClassName}>
          {precoInfo.precoAnterior ? (
            <p className="produto-price-old">de {formatCurrency(precoInfo.precoAnterior)}</p>
          ) : null}
          <p className={priceClassName}>{formatCurrency(precoInfo.precoAtual)}</p>

          {medidaProduto ? (
            <p className="produto-price-unit">Unidade: {medidaProduto}</p>
          ) : null}

          {precoInfo.economia > 0 ? (
            <p className="produto-price-saving">Economize {formatCurrency(precoInfo.economia)}</p>
          ) : null}
          {precoInfo.precoPix ? (
            <p className="produto-price-pix">{formatCurrency(precoInfo.precoPix)} no Pix</p>
          ) : null}
        </div>

        {indicadorUrgencia ? <p className="produto-urgency">{indicadorUrgencia}</p> : null}
      </div>

      <div className="produto-card-actions">
        {quantidadeNoCarrinho > 0 ? (
          <div className="produto-qty-control" aria-label={`Quantidade de ${nomeProduto} no carrinho`}>
            <button
              type="button"
              className="produto-qty-btn"
              onClick={() => onDecreaseItem(produto, quantidadeNoCarrinho)}
              aria-label={`Diminuir quantidade de ${nomeProduto}`}
              disabled={estaAdicionando}
            >
              -
            </button>
            <span className="produto-qty-value">{quantidadeNoCarrinho} no carrinho</span>
            <button
              type="button"
              className="produto-qty-btn"
              onClick={handleIncreaseLocal}
              aria-label={`Aumentar quantidade de ${nomeProduto}`}
              disabled={estaAdicionando}
            >
              +
            </button>
          </div>
        ) : null}

        {microcopyConversao ? <p className="produto-microcopy">{microcopyConversao}</p> : null}

        <div className="produto-card-actions-row">
          <button
            className={`btn-primary produto-add-btn ${estaAdicionando ? 'is-loading' : ''}`.trim()}
            type="button"
            onClick={handleAddItemLocal}
            disabled={!podeComprar || estaAdicionando}
          >
            {ctaPrimaria}
          </button>

          <button
            className="btn-secondary produto-detail-btn"
            type="button"
            onClick={() => onOpenDetail(produtoIndexado.chaveReact)}
          >
            Ver detalhes
          </button>
        </div>

        {foiAdicionadoRecente ? (
          <p className="produto-card-feedback" role="status" aria-live="polite">
            Adicionado ao carrinho ✅
          </p>
        ) : null}
      </div>
    </article>
  );
});

ProdutoCard.displayName = 'ProdutoCard';

export default ProdutoCard;
