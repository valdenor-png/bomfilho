import React, { useEffect, useMemo, useState } from 'react';
import SmartImage from './ui/SmartImage';

function ProdutoFallbackPadrao({ icone = '📦' }) {
  return (
    <div className="produto-image-fallback" role="img" aria-label="Imagem em atualizacao">
      <span className="produto-image-fallback-icon" aria-hidden="true">{icone}</span>
      <span className="produto-image-fallback-text">Imagem em atualizacao</span>
    </div>
  );
}

const ProdutoRecomendadoCard = React.memo(function ProdutoRecomendadoCard({
  produtoIndexado,
  quantidadeNoCarrinho = 0,
  onAddItem,
  isAddingItem,
  onOpenDetail,
  formatCurrency,
  getPlaceholderIconePorCategoria
}) {
  const produto = produtoIndexado.produto;
  const imagem = produtoIndexado.imagemResponsiva;
  const nomeProduto = produtoIndexado.nomeProduto;
  const categoriaLabel = produtoIndexado.categoriaLabel;
  const precoInfo = produtoIndexado.precoInfo;
  const podeComprar = produtoIndexado.carrinhoId !== null;
  const estaAdicionando = typeof isAddingItem === 'function' ? isAddingItem(produto) : false;
  const precoLabel = formatCurrency(precoInfo.precoAtual);
  const temPrecoNoCta = Number(precoInfo.precoAtual || 0) > 0;
  const ctaRecomendado = !podeComprar
    ? 'Indisponivel'
    : (estaAdicionando
      ? 'Adicionando...'
      : (temPrecoNoCta
        ? (quantidadeNoCarrinho > 0 ? `Adicionar ao carrinho • ${precoLabel}` : `Levar por ${precoLabel}`)
        : 'Adicionar ao carrinho'));
  const [imagemIndisponivel, setImagemIndisponivel] = useState(() => !imagem.src);

  useEffect(() => {
    setImagemIndisponivel(!imagem.src);
  }, [imagem.src]);

  const iconeFallback = typeof getPlaceholderIconePorCategoria === 'function'
    ? getPlaceholderIconePorCategoria(produto)
    : '📦';

  return (
    <article className="product-reco-card">
      <button
        type="button"
        className="product-reco-media-btn"
        onClick={() => onOpenDetail(produtoIndexado.chaveReact)}
        aria-label={`Ver detalhes de ${nomeProduto}`}
      >
        {imagemIndisponivel ? (
          <div className="product-reco-image-fallback" aria-hidden="true">
            <span>{iconeFallback}</span>
          </div>
        ) : (
          <SmartImage
            className="product-reco-image"
            src={imagem.src}
            srcSet={imagem.srcSet}
            sizes={imagem.sizes}
            alt={nomeProduto}
            loading="lazy"
            decoding="async"
            onError={() => {
              setImagemIndisponivel(true);
            }}
          />
        )}
      </button>

      <div className="product-reco-info">
        <p className="product-reco-category">{categoriaLabel}</p>
        <h4 className="product-reco-title" title={nomeProduto}>{nomeProduto}</h4>
        <p className="product-reco-price">{formatCurrency(precoInfo.precoAtual)}</p>
      </div>

      <div className="product-reco-actions">
        <button
          type="button"
          className="btn-secondary product-reco-view-btn"
          onClick={() => onOpenDetail(produtoIndexado.chaveReact)}
        >
          Ver detalhes
        </button>

        <button
          type="button"
          className="btn-primary product-reco-add-btn"
          onClick={() => onAddItem(produto)}
          disabled={!podeComprar || estaAdicionando}
        >
          {ctaRecomendado}
        </button>
      </div>
    </article>
  );
});

ProdutoRecomendadoCard.displayName = 'ProdutoRecomendadoCard';

const ProdutoDecisionDrawer = React.memo(function ProdutoDecisionDrawer({
  produtoIndexado,
  quantidadeNoCarrinho,
  favorito = false,
  recomendacoes,
  onClose,
  onAddItem,
  onIncreaseItem,
  onDecreaseItem,
  onToggleFavorito,
  isAddingItem,
  getQuantidadeProduto,
  onOpenDetail,
  formatCurrency,
  getProdutoMedida,
  getProdutoBadges,
  ProdutoBadgeComponent,
  ProdutoImageFallbackComponent,
  getPlaceholderIconePorCategoria
}) {
  const produto = produtoIndexado?.produto || null;
  const imagem = produtoIndexado?.imagemResponsiva || {
    src: '',
    srcSet: undefined,
    sizes: '(max-width: 900px) 100vw, 46vw'
  };
  const nomeProduto = produtoIndexado?.nomeProduto || 'Produto';
  const categoriaLabel = produtoIndexado?.categoriaLabel || 'Categoria nao informada';
  const detalhesProduto = produtoIndexado?.detalhesComerciais || 'Informacoes comerciais em atualizacao';
  const precoInfo = produtoIndexado?.precoInfo || {
    precoAtual: 0,
    precoAnterior: null,
    economia: 0,
    precoPix: null
  };
  const formatarMoeda = typeof formatCurrency === 'function'
    ? formatCurrency
    : (valor) => String(valor ?? '');
  const podeComprar = Boolean(produtoIndexado && produtoIndexado.carrinhoId !== null);
  const estaAdicionando = typeof isAddingItem === 'function' ? isAddingItem(produto) : false;
  const precoLabel = formatarMoeda(precoInfo.precoAtual);
  const temPrecoNoCta = Number(precoInfo.precoAtual || 0) > 0;
  const ctaPrincipal = !podeComprar
    ? 'Indisponivel no momento'
    : (estaAdicionando
      ? 'Adicionando...'
      : (temPrecoNoCta
        ? (quantidadeNoCarrinho > 0
          ? `Adicionar ao carrinho • ${precoLabel}`
          : (precoInfo.precoAnterior ? `Levar por ${precoLabel}` : `Adicionar • ${precoLabel}`))
        : 'Adicionar ao carrinho'));
  const descricaoProduto = String(produto?.descricao || '').trim();
  const possuiDescricao = Boolean(descricaoProduto);
  const marcaProduto = String(produto?.marca || '').trim();
  const medidaProduto = typeof getProdutoMedida === 'function' ? getProdutoMedida(produto) : '';
  const badges = useMemo(() => {
    if (!produtoIndexado || typeof getProdutoBadges !== 'function') {
      return [];
    }
    return getProdutoBadges(produtoIndexado);
  }, [getProdutoBadges, produtoIndexado]);
  const chipsValorComercial = useMemo(() => {
    const chips = [];

    if (precoInfo.precoAnterior && precoInfo.economia > 0) {
      chips.push(`Economia real de ${formatarMoeda(precoInfo.economia)}`);
    }

    if (precoInfo.precoPix) {
      chips.push(`${formatarMoeda(precoInfo.precoPix)} no Pix`);
    }

    if (marcaProduto) {
      chips.push(`Marca: ${marcaProduto}`);
    }

    if (medidaProduto) {
      chips.push(`Unidade: ${medidaProduto}`);
    }

    if (favorito) {
      chips.push('Item salvo nos seus favoritos');
    }

    return chips.slice(0, 4);
  }, [favorito, formatarMoeda, marcaProduto, medidaProduto, precoInfo.economia, precoInfo.precoAnterior, precoInfo.precoPix]);
  const [imagemIndisponivel, setImagemIndisponivel] = useState(() => !imagem.src);

  useEffect(() => {
    setImagemIndisponivel(!imagem.src);
  }, [imagem.src]);

  if (!produtoIndexado || !produto) {
    return null;
  }

  const mensagemDescricao = possuiDescricao
    ? descricaoProduto
    : 'Descricao em atualizacao. Confira nome, categoria, unidade e preco para decidir sua compra com seguranca.';

  const mensagensConfianca = [
    'Produto selecionado para sua compra.',
    'Confira unidade e quantidade antes de adicionar.',
    'Preco e disponibilidade sujeitos a confirmacao no checkout.'
  ];

  if (marcaProduto) {
    mensagensConfianca.push(`Marca informada: ${marcaProduto}.`);
  }
  if (medidaProduto) {
    mensagensConfianca.push(`Unidade ou medida: ${medidaProduto}.`);
  }
  const ProdutoBadge = ProdutoBadgeComponent;
  const ProdutoImageFallback = ProdutoImageFallbackComponent;
  const iconeFallbackProduto = typeof getPlaceholderIconePorCategoria === 'function'
    ? getPlaceholderIconePorCategoria(produto)
    : '📦';

  return (
    <div className="product-detail-overlay" role="presentation" onClick={onClose}>
      <aside
        className="product-detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${nomeProduto}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="product-detail-header">
          <div>
            <p className="product-detail-kicker">Decisao de compra inteligente</p>
            <h2>{nomeProduto}</h2>
          </div>

          <div className="product-detail-header-actions">
            <button
              type="button"
              className={`product-detail-favorite-btn ${favorito ? 'is-active' : ''}`}
              onClick={() => {
                if (typeof onToggleFavorito === 'function') {
                  onToggleFavorito(produto);
                }
              }}
              aria-label={favorito ? `Remover ${nomeProduto} dos favoritos` : `Salvar ${nomeProduto} nos favoritos`}
            >
              {favorito ? '♥ Favorito' : '♡ Favoritar'}
            </button>

            <button
              type="button"
              className="product-detail-close-btn"
              onClick={onClose}
              aria-label="Fechar detalhes do produto"
            >
              ×
            </button>
          </div>
        </header>

        <div className="product-detail-content">
          <section className="product-detail-main" aria-label="Informacoes principais do produto">
            <div className="product-detail-media">
              {badges.length > 0 ? (
                <div className="produto-badges" aria-label="Selos do produto">
                  {badges.map((badge) => (
                    ProdutoBadge
                      ? <ProdutoBadge key={`${badge.tone}:${badge.label}`} tone={badge.tone} label={badge.label} />
                      : null
                  ))}
                </div>
              ) : null}

              {imagemIndisponivel ? (
                ProdutoImageFallback
                  ? <ProdutoImageFallback produto={produto} />
                  : <ProdutoFallbackPadrao icone={iconeFallbackProduto} />
              ) : (
                <SmartImage
                  className="product-detail-image"
                  src={imagem.src}
                  srcSet={imagem.srcSet}
                  sizes="(max-width: 900px) 100vw, 46vw"
                  alt={nomeProduto}
                  priority
                  loading="eager"
                  decoding="async"
                  onError={() => {
                    setImagemIndisponivel(true);
                  }}
                />
              )}
            </div>

            <div className="product-detail-info">
              <p className="product-detail-category">{categoriaLabel}</p>
              <p className="product-detail-meta">{detalhesProduto}</p>

              <p className="product-detail-status" role="status">
                {podeComprar ? 'Disponivel para adicionar agora' : 'Indisponivel no momento'}
              </p>

              {chipsValorComercial.length > 0 ? (
                <div className="product-detail-value-chips" aria-label="Vantagens comerciais do item">
                  {chipsValorComercial.map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
              ) : null}

              {favorito ? (
                <p className="product-detail-favorite-copy">Este item esta salvo nos seus favoritos.</p>
              ) : null}

              <p className="product-detail-description">{mensagemDescricao}</p>

              <div className="product-detail-trust-box" aria-label="Sinais de confianca">
                <p className="product-detail-trust-title">Compra com mais confianca</p>
                <ul className="product-detail-trust-list">
                  {mensagensConfianca.map((mensagem) => (
                    <li key={mensagem}>{mensagem}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <aside className="product-detail-buy-box" aria-label="Bloco de compra do produto">
            <p className="product-detail-price">{formatarMoeda(precoInfo.precoAtual)}</p>

            {precoInfo.precoAnterior ? (
              <p className="product-detail-price-old">de {formatarMoeda(precoInfo.precoAnterior)}</p>
            ) : null}

            {precoInfo.economia > 0 ? (
              <p className="product-detail-price-saving">Economize {formatarMoeda(precoInfo.economia)}</p>
            ) : null}

            {precoInfo.precoPix ? (
              <p className="product-detail-price-pix">{formatarMoeda(precoInfo.precoPix)} no Pix</p>
            ) : null}

            <p className="product-detail-qty-hint" role="status">
              {quantidadeNoCarrinho > 0
                ? `${quantidadeNoCarrinho} ${quantidadeNoCarrinho === 1 ? 'unidade no carrinho' : 'unidades no carrinho'}`
                : 'Ainda nao adicionado ao carrinho'}
            </p>

            {quantidadeNoCarrinho > 0 ? (
              <div className="produto-qty-control product-detail-qty-control" aria-label={`Quantidade de ${nomeProduto} no carrinho`}>
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
                  onClick={() => onIncreaseItem(produto)}
                  aria-label={`Aumentar quantidade de ${nomeProduto}`}
                  disabled={estaAdicionando}
                >
                  +
                </button>
              </div>
            ) : null}

            <div className="product-detail-cta-row">
              <button
                type="button"
                className={`btn-primary product-detail-add-btn ${estaAdicionando ? 'is-loading' : ''}`.trim()}
                onClick={() => onAddItem(produto)}
                disabled={!podeComprar || estaAdicionando}
              >
                {ctaPrincipal}
              </button>

              <button
                type="button"
                className="btn-secondary product-detail-continue-btn"
                onClick={onClose}
              >
                Continuar comprando
              </button>
            </div>
          </aside>

          {recomendacoes.length > 0 ? (
            <section className="product-detail-recommendations" aria-label="Produtos relacionados">
              <div className="product-detail-recommendations-head">
                <h3>Combine com este item</h3>
                <p>Produtos relacionados para completar sua compra com praticidade.</p>
              </div>

              <div className="product-reco-grid">
                {recomendacoes.map((item) => (
                  <ProdutoRecomendadoCard
                    key={`reco:${item.chaveReact}`}
                    produtoIndexado={item}
                    quantidadeNoCarrinho={getQuantidadeProduto(item.produto)}
                    onAddItem={onAddItem}
                    isAddingItem={isAddingItem}
                    onOpenDetail={onOpenDetail}
                    formatCurrency={formatarMoeda}
                    getPlaceholderIconePorCategoria={getPlaceholderIconePorCategoria}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
});

ProdutoDecisionDrawer.displayName = 'ProdutoDecisionDrawer';

export default ProdutoDecisionDrawer;
