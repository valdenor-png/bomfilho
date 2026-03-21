import React, { useCallback, useMemo } from 'react';
import { Grid } from 'react-window';
import useElementWidth from '../../hooks/useElementWidth';
import useViewportHeight from '../../hooks/useViewportHeight';
import ProdutoCard from './ProdutoCard';
import {
  VIRTUALIZATION_THRESHOLD,
  VIRTUAL_GRID_GAP,
  VIRTUAL_CARD_MIN_WIDTH_DESKTOP,
  VIRTUAL_CARD_MIN_WIDTH_MOBILE,
  VIRTUAL_CARD_HEIGHT_DESKTOP,
  VIRTUAL_CARD_HEIGHT_MOBILE,
  VIRTUAL_GRID_MIN_HEIGHT
} from '../../lib/produtosUtils';

const VirtualizedProdutoGrid = React.memo(function VirtualizedProdutoGrid({
  itensIndexados,
  onAddItem,
  onIncreaseItem,
  onDecreaseItem,
  onToggleFavorito,
  onOpenDetail,
  getQuantidadeProduto,
  chavesMaisVendidos,
  idsNovidades,
  favoritosIdsSet,
  recompraIdsSet,
  idsAltaConversaoSet,
  growthExperimento,
  produtoAdicionadoRecenteId,
  isProdutoAdicionando = () => false,
  categoriasRecompraSet = new Set(),
  gridClassName = 'produto-grid',
  listId
}) {
  const [containerRef, containerWidth] = useElementWidth();
  const viewportHeight = useViewportHeight();

  const usarVirtualizacao = itensIndexados.length >= VIRTUALIZATION_THRESHOLD;

  const isMobileViewport = containerWidth > 0 && containerWidth < 700;
  const minCardWidth = isMobileViewport ? VIRTUAL_CARD_MIN_WIDTH_MOBILE : VIRTUAL_CARD_MIN_WIDTH_DESKTOP;
  const cardHeight = isMobileViewport ? VIRTUAL_CARD_HEIGHT_MOBILE : VIRTUAL_CARD_HEIGHT_DESKTOP;

  const columnCount = Math.max(
    1,
    Math.floor((containerWidth + VIRTUAL_GRID_GAP) / (minCardWidth + VIRTUAL_GRID_GAP)) || 1
  );

  const totalHorizontalGap = Math.max(0, columnCount - 1) * VIRTUAL_GRID_GAP;
  const cardWidth = Math.max(
    140,
    Math.floor((Math.max(containerWidth, minCardWidth) - totalHorizontalGap) / columnCount)
  );

  const gridColumnWidth = cardWidth + VIRTUAL_GRID_GAP;
  const gridRowHeight = cardHeight + VIRTUAL_GRID_GAP;
  const rowCount = Math.max(1, Math.ceil(itensIndexados.length / columnCount));

  const maxViewportHeight = Math.max(
    VIRTUAL_GRID_MIN_HEIGHT,
    Math.floor(viewportHeight * (isMobileViewport ? 0.58 : 0.68))
  );
  const gridHeight = Math.max(
    VIRTUAL_GRID_MIN_HEIGHT,
    Math.min(maxViewportHeight, rowCount * gridRowHeight)
  );

  const itemData = useMemo(() => ({
    itensIndexados,
    onAddItem,
    onIncreaseItem,
    onDecreaseItem,
    onToggleFavorito,
    onOpenDetail,
    getQuantidadeProduto,
    chavesMaisVendidos,
    idsNovidades,
    favoritosIdsSet,
    recompraIdsSet,
    idsAltaConversaoSet,
    categoriasRecompraSet,
    growthExperimento,
    produtoAdicionadoRecenteId,
    isProdutoAdicionando,
    columnCount,
    isMobileViewport
  }), [
    chavesMaisVendidos,
    columnCount,
    getQuantidadeProduto,
    idsNovidades,
    itensIndexados,
    onAddItem,
    onDecreaseItem,
    onIncreaseItem,
    onToggleFavorito,
    onOpenDetail,
    favoritosIdsSet,
    growthExperimento,
    idsAltaConversaoSet,
    categoriasRecompraSet,
    isMobileViewport,
    recompraIdsSet
  ]);
  const shellClassName = gridClassName.includes('brand-produto-grid')
    ? 'produto-grid-virtualized-shell brand-produto-grid-virtualized'
    : 'produto-grid-virtualized-shell';

  const renderCell = useCallback(({
    ariaAttributes,
    columnIndex,
    rowIndex,
    style,
    itensIndexados: itens,
    onAddItem: onAdd,
    onIncreaseItem: onIncrease,
    onDecreaseItem: onDecrease,
    onToggleFavorito: onToggleFav,
    onOpenDetail: onDetail,
    getQuantidadeProduto: getQtd,
    chavesMaisVendidos: maisVendidos,
    idsNovidades: novidades,
    favoritosIdsSet: favoritosSet,
    recompraIdsSet: recompraSet,
    idsAltaConversaoSet: altaConversaoSet,
    categoriasRecompraSet: catRecompraSet,
    growthExperimento: growth,
    produtoAdicionadoRecenteId: adicionadoRecenteId,
    isProdutoAdicionando: isAddingProduto,
    columnCount: columns,
    isMobileViewport: isMobile
  }) => {
    const index = rowIndex * columns + columnIndex;
    const produtoIndexado = itens[index];
    const proximoProdutoIndexado = itens[index + 1] || null;

    if (!produtoIndexado) {
      return null;
    }

    const destaqueMaisVendido = maisVendidos.has(produtoIndexado.chaveReact);
    const destaqueNovo = produtoIndexado.carrinhoId !== null && novidades.has(produtoIndexado.carrinhoId);

    const width = typeof style.width === 'number' ? style.width : Number.parseFloat(style.width || '0');
    const height = typeof style.height === 'number' ? style.height : Number.parseFloat(style.height || '0');

    return (
      <div
        className="produto-grid-virtualized-cell"
        {...ariaAttributes}
        style={{
          ...style,
          width: Math.max(0, width - VIRTUAL_GRID_GAP),
          height: Math.max(0, height - VIRTUAL_GRID_GAP)
        }}
      >
        <ProdutoCard
          index={index}
          isMobileViewport={isMobile}
          nextImageSrc={proximoProdutoIndexado?.imagemResponsiva?.src || ''}
          produtoIndexado={produtoIndexado}
          estaAdicionando={isAddingProduto(produtoIndexado.produto)}
          quantidadeNoCarrinho={getQtd(produtoIndexado.produto)}
          destaqueMaisVendido={destaqueMaisVendido}
          destaqueNovo={destaqueNovo}
          favorito={
            produtoIndexado.carrinhoId !== null
            && favoritosSet.has(produtoIndexado.carrinhoId)
          }
          sinalRecorrente={
            produtoIndexado.carrinhoId !== null
            && recompraSet.has(produtoIndexado.carrinhoId)
          }
          sinalRecomendado={
            catRecompraSet.size > 0
            && produtoIndexado.carrinhoId !== null
            && !recompraSet.has(produtoIndexado.carrinhoId)
            && !favoritosSet.has(produtoIndexado.carrinhoId)
            && catRecompraSet.has(produtoIndexado.categoriaNormalizada)
            && produtoIndexado.estoqueInfo?.semEstoque !== true
          }
          destaqueConversao={
            produtoIndexado.carrinhoId !== null
            && altaConversaoSet.has(produtoIndexado.carrinhoId)
          }
          growthExperimento={growth}
          foiAdicionadoRecente={
            produtoIndexado.carrinhoId !== null
            && produtoIndexado.carrinhoId === adicionadoRecenteId
          }
          onAddItem={onAdd}
          onIncreaseItem={onIncrease}
          onDecreaseItem={onDecrease}
          onToggleFavorito={onToggleFav}
          onOpenDetail={onDetail}
        />
      </div>
    );
  }, []);

  if (!usarVirtualizacao) {
    const isMobileCardPriority = isMobileViewport
      || (containerWidth === 0 && typeof window !== 'undefined' && window.innerWidth < 700);

    return (
      <div className={gridClassName} id={listId}>
        {itensIndexados.map((produtoIndexado, index) => (
          <ProdutoCard
            key={produtoIndexado.chaveReact}
            index={index}
            isMobileViewport={isMobileCardPriority}
            nextImageSrc={itensIndexados[index + 1]?.imagemResponsiva?.src || ''}
            produtoIndexado={produtoIndexado}
            estaAdicionando={isProdutoAdicionando(produtoIndexado.produto)}
            quantidadeNoCarrinho={getQuantidadeProduto(produtoIndexado.produto)}
            destaqueMaisVendido={chavesMaisVendidos.has(produtoIndexado.chaveReact)}
            destaqueNovo={
              produtoIndexado.carrinhoId !== null
              && idsNovidades.has(produtoIndexado.carrinhoId)
            }
            favorito={
              produtoIndexado.carrinhoId !== null
              && favoritosIdsSet.has(produtoIndexado.carrinhoId)
            }
            sinalRecorrente={
              produtoIndexado.carrinhoId !== null
              && recompraIdsSet.has(produtoIndexado.carrinhoId)
            }
            sinalRecomendado={
              categoriasRecompraSet.size > 0
              && produtoIndexado.carrinhoId !== null
              && !recompraIdsSet.has(produtoIndexado.carrinhoId)
              && !favoritosIdsSet.has(produtoIndexado.carrinhoId)
              && categoriasRecompraSet.has(produtoIndexado.categoriaNormalizada)
              && produtoIndexado.estoqueInfo?.semEstoque !== true
            }
            destaqueConversao={
              produtoIndexado.carrinhoId !== null
              && idsAltaConversaoSet.has(produtoIndexado.carrinhoId)
            }
            growthExperimento={growthExperimento}
            foiAdicionadoRecente={
              produtoIndexado.carrinhoId !== null
              && produtoIndexado.carrinhoId === produtoAdicionadoRecenteId
            }
            onAddItem={onAddItem}
            onIncreaseItem={onIncreaseItem}
            onDecreaseItem={onDecreaseItem}
            onToggleFavorito={onToggleFavorito}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={shellClassName} id={listId} ref={containerRef}>
      {containerWidth > 0 ? (
        <Grid
          className="produto-grid-virtualized"
          style={{
            width: containerWidth,
            height: gridHeight
          }}
          defaultWidth={containerWidth}
          defaultHeight={gridHeight}
          cellComponent={renderCell}
          cellProps={itemData}
          columnCount={columnCount}
          columnWidth={gridColumnWidth}
          rowCount={rowCount}
          rowHeight={gridRowHeight}
          overscanCount={isMobileViewport ? 3 : 4}
        />
      ) : (
        <div className={gridClassName}>
          {itensIndexados.slice(0, 12).map((produtoIndexado, index) => (
            <ProdutoCard
              key={produtoIndexado.chaveReact}
              index={index}
              isMobileViewport={typeof window !== 'undefined' && window.innerWidth < 700}
              nextImageSrc={itensIndexados[index + 1]?.imagemResponsiva?.src || ''}
              produtoIndexado={produtoIndexado}
              estaAdicionando={isProdutoAdicionando(produtoIndexado.produto)}
              quantidadeNoCarrinho={getQuantidadeProduto(produtoIndexado.produto)}
              destaqueMaisVendido={chavesMaisVendidos.has(produtoIndexado.chaveReact)}
              destaqueNovo={
                produtoIndexado.carrinhoId !== null
                && idsNovidades.has(produtoIndexado.carrinhoId)
              }
              favorito={
                produtoIndexado.carrinhoId !== null
                && favoritosIdsSet.has(produtoIndexado.carrinhoId)
              }
              sinalRecorrente={
                produtoIndexado.carrinhoId !== null
                && recompraIdsSet.has(produtoIndexado.carrinhoId)
              }
              sinalRecomendado={
                categoriasRecompraSet.size > 0
                && produtoIndexado.carrinhoId !== null
                && !recompraIdsSet.has(produtoIndexado.carrinhoId)
                && !favoritosIdsSet.has(produtoIndexado.carrinhoId)
                && categoriasRecompraSet.has(produtoIndexado.categoriaNormalizada)
                && produtoIndexado.estoqueInfo?.semEstoque !== true
              }
              destaqueConversao={
                produtoIndexado.carrinhoId !== null
                && idsAltaConversaoSet.has(produtoIndexado.carrinhoId)
              }
              growthExperimento={growthExperimento}
              foiAdicionadoRecente={
                produtoIndexado.carrinhoId !== null
                && produtoIndexado.carrinhoId === produtoAdicionadoRecenteId
              }
              onAddItem={onAddItem}
              onIncreaseItem={onIncreaseItem}
              onDecreaseItem={onDecreaseItem}
              onToggleFavorito={onToggleFavorito}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
});

VirtualizedProdutoGrid.displayName = 'VirtualizedProdutoGrid';

export default VirtualizedProdutoGrid;
