import React from 'react';

const SubcategoryNav = React.memo(function SubcategoryNav({
  title = '',
  subcategories = [],
  activeSubcategoryId = 'todas',
  onSelect,
  onWheel
}) {
  const subcategoriesList = Array.isArray(subcategories) ? subcategories : [];
  const hasOnlyTodos = subcategoriesList.length === 0;

  if (!title && hasOnlyTodos) {
    return null;
  }

  return (
    <div className="subcategoria-nav bebidas-subcats" aria-label={title || 'Subcategorias'}>
      {title ? <p className="subcategoria-nav-title bebidas-subcats-title">{title}</p> : null}
      <div className="subcategoria-nav-actions bebidas-subcats-actions" onWheel={onWheel}>
        <button
          type="button"
          className={`subcategoria-chip category-btn-react ${activeSubcategoryId === 'todas' ? 'active' : ''}`}
          onClick={() => onSelect?.('todas')}
          aria-pressed={activeSubcategoryId === 'todas'}
        >
          Todos
        </button>
        {subcategoriesList.map((subcategory) => {
          const id = String(subcategory?.id || '');
          const label = String(subcategory?.label || 'Subcategoria');
          const count = Number(subcategory?.count || 0);

          return (
            <button
              key={id}
              type="button"
              className={`subcategoria-chip category-btn-react ${activeSubcategoryId === id ? 'active' : ''}`}
              onClick={() => onSelect?.(id)}
              aria-pressed={activeSubcategoryId === id}
            >
              {label}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default SubcategoryNav;
