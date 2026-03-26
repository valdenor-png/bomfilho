import React from 'react';

const CategorySection = React.memo(function CategorySection({
  section,
  sectionRef,
  items = [],
  isActive = false,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  loadMoreLabel = 'Ver mais',
  renderRow,
  emptyMessage = 'Nenhum produto disponivel nesta categoria no momento.'
}) {
  if (!section) {
    return null;
  }

  const id = String(section?.id || 'outros');
  const title = String(section?.label || 'Categoria');
  const displayedItems = Array.isArray(items) ? items : [];
  const canLoadMore = Boolean(hasMore) && typeof onLoadMore === 'function';

  return (
    <section
      className={`vitrine-secao ${isActive ? 'is-active-section' : ''}`.trim()}
      aria-label={`Categoria ${title}`}
      ref={sectionRef}
      id={`vitrine-${id}`}
      data-category-id={id}
    >
      <div className="vitrine-secao-header">
        <h2 className="vitrine-secao-titulo">{title}</h2>
        {canLoadMore ? (
          <button
            type="button"
            className="vitrine-ver-mais"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Carregando...' : loadMoreLabel}
          </button>
        ) : null}
      </div>
      {displayedItems.length > 0 ? (
        renderRow?.(displayedItems)
      ) : (
        <div className="categoria-horizontal-empty" role="status" aria-live="polite">
          {emptyMessage}
        </div>
      )}
    </section>
  );
});

export default CategorySection;
