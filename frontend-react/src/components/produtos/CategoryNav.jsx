import React from 'react';
import { Tag } from '../../icons';

const CategoryNav = React.memo(function CategoryNav({
  categories = [],
  activeCategoryId = 'todas',
  onSelect,
  onWheel
}) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return null;
  }

  return (
    <nav className="products-quick-categories" aria-label="Categorias rapidas" onWheel={onWheel}>
      {categories.map((category) => {
        const id = String(category?.id || '');
        const label = String(category?.label || 'Categoria');
        const Icon = typeof category?.icon === 'function' ? category.icon : Tag;
        const isActive = id === activeCategoryId;

        return (
          <button
            key={id}
            type="button"
            className={`products-quick-cat-item${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect?.(id)}
            aria-pressed={isActive}
            title={label}
          >
            <span className="products-quick-cat-icon" aria-hidden="true">
              <Icon size={16} strokeWidth={2} />
            </span>
            <span className="products-quick-cat-label-wrap">
              <span className="products-quick-cat-label">{label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
});

export default CategoryNav;
