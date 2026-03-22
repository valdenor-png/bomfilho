import React from 'react';

const CategorySection = React.memo(function CategorySection({
  section,
  sectionRef,
  items = [],
  isActive = false,
  onViewAll,
  renderRow,
  emptyMessage = 'Carregando produtos desta categoria...'
}) {
  if (!section) {
    return null;
  }

  const id = String(section?.id || 'outros');
  const title = String(section?.label || 'Categoria');
  const totalItems = Number(section?.totalItens || 0);
  const displayedItems = Array.isArray(items) ? items : [];
  const hasViewAll = totalItems > 20 && typeof onViewAll === 'function';

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
        {hasViewAll ? (
          <button
            type="button"
            className="vitrine-ver-mais"
            onClick={onViewAll}
          >
            Ver todos ({totalItems})
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
