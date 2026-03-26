import React from 'react';

const CategorySection = React.memo(function CategorySection({
  section,
  sectionRef,
  items = [],
  isActive = false,
  onAction,
  actionLabel = '',
  actionDisabled = false,
  renderRow,
  emptyMessage = 'Nenhum produto disponivel nesta categoria no momento.'
}) {
  if (!section) {
    return null;
  }

  const id = String(section?.id || 'outros');
  const title = String(section?.label || 'Categoria');
  const displayedItems = Array.isArray(items) ? items : [];
  const canShowAction = Boolean(String(actionLabel || '').trim()) && typeof onAction === 'function';

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
        {canShowAction ? (
          <button
            type="button"
            className="vitrine-ver-mais"
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionLabel}
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
