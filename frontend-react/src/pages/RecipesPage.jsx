import React, { useState } from 'react';
import { colors, fonts, formatProductName } from '../theme';
import Icon from '../components/Icon';
import { recipes } from '../data/recipes';

const categoryFilters = ['Todos', 'Cafe da Manha', 'Almoco', 'Lanche', 'Jantar'];

export default function RecipesPage({ onAdd, products = [] }) {
  const [filter, setFilter] = useState('Todos');
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  const filtered = filter === 'Todos'
    ? recipes
    : recipes.filter(r => r.category === filter);

  const handleAddIngredients = (recipe) => {
    let added = 0;
    for (const ing of recipe.ingredients) {
      if (ing.productId && onAdd) {
        const product = products.find(p => p.id === Number(ing.productId));
        if (product) { onAdd(product.id); added++; }
      }
    }
    if (added > 0) {
      // feedback handled by parent toast
    }
  };

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <h1 style={{ fontSize: 17, fontWeight: 800, color: colors.white, margin: '12px 0 4px', fontFamily: fonts.text }}>
        Receitas
      </h1>
      <p style={{ fontSize: 11, color: colors.textMuted, marginBottom: 10, fontFamily: fonts.text }}>
        Adicione todos os ingredientes ao carrinho com 1 toque
      </p>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: 14 }}>
        {categoryFilters.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{
            padding: '6px 13px', borderRadius: 20, whiteSpace: 'nowrap',
            background: filter === cat ? 'rgba(226,184,74,0.15)' : 'rgba(255,255,255,0.07)',
            border: `1px solid ${filter === cat ? 'rgba(226,184,74,0.3)' : 'rgba(255,255,255,0.1)'}`,
            color: filter === cat ? colors.gold : 'rgba(255,255,255,0.7)',
            fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: fonts.text,
          }}>{cat}</button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(recipe => {
          const availableCount = recipe.ingredients.filter(i => i.productId).length;
          return (
            <div key={recipe.id} onClick={() => setSelectedRecipe(recipe)} style={{
              background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: 16, padding: 16, cursor: 'pointer',
            }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{recipe.emoji}</div>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: colors.white, margin: '0 0 3px', fontFamily: fonts.text }}>
                {recipe.title}
              </h3>
              <p style={{ fontSize: 11, color: colors.textMuted, margin: '0 0 8px', lineHeight: 1.4, fontFamily: fonts.text }}>
                {recipe.description}
              </p>
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                <span>{recipe.prep_time + recipe.cook_time}min</span>
                <span>{recipe.servings} porcoes</span>
                <span style={{ color: '#5AE4A7' }}>
                  {recipe.difficulty === 'facil' ? 'Facil' : recipe.difficulty === 'medio' ? 'Medio' : 'Dificil'}
                </span>
              </div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: fonts.text }}>
                {recipe.ingredients.length} ingredientes {availableCount > 0 && `\u00B7 ${availableCount} disponiveis`}
              </span>
              <button onClick={(e) => { e.stopPropagation(); handleAddIngredients(recipe); }} style={{
                width: '100%', marginTop: 10, padding: 10, borderRadius: 12,
                background: colors.gold, border: 'none', color: colors.bgDeep,
                fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: fonts.text,
                boxShadow: '0 2px 8px rgba(226,184,74,0.3)',
              }}>
                Adicionar ingredientes
              </button>
            </div>
          );
        })}
      </div>

      {/* Recipe detail modal */}
      {selectedRecipe && (
        <div onClick={() => setSelectedRecipe(null)} style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto',
            background: colors.bgDark || '#174A40',
            borderRadius: '20px 20px 0 0', border: `1px solid ${colors.border}`,
            padding: '20px 16px 90px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>{selectedRecipe.emoji}</span>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: colors.white, margin: 0, fontFamily: fonts.text }}>
                  {selectedRecipe.title}
                </h2>
                <p style={{ fontSize: 12, color: colors.textMuted, margin: '4px 0 0', fontFamily: fonts.text }}>
                  {selectedRecipe.description}
                </p>
              </div>
              <button onClick={() => setSelectedRecipe(null)} style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'rgba(255,255,255,0.07)', border: `1px solid ${colors.border}`,
                color: 'rgba(255,255,255,0.6)', fontSize: 14, cursor: 'pointer',
              }}>x</button>
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              <span>Preparo: {selectedRecipe.prep_time}min</span>
              <span>Cozimento: {selectedRecipe.cook_time}min</span>
              <span>{selectedRecipe.servings} porcoes</span>
            </div>

            {/* Ingredientes */}
            <h3 style={{ fontSize: 13, fontWeight: 800, color: colors.white, margin: '0 0 8px', fontFamily: fonts.text }}>
              Ingredientes
            </h3>
            {selectedRecipe.ingredients.map((ing, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                borderBottom: i < selectedRecipe.ingredients.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none',
                fontSize: 12, color: colors.white, fontFamily: fonts.text,
                opacity: ing.productId ? 1 : 0.5,
              }}>
                <span style={{ width: 14, fontSize: 8, textAlign: 'center' }}>
                  {ing.productId ? '\u{1F7E2}' : '\u26AA'}
                </span>
                <span style={{ flex: 1 }}>{ing.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: fonts.number }}>
                  {ing.quantity}
                </span>
              </div>
            ))}

            {/* Modo de preparo */}
            <h3 style={{ fontSize: 13, fontWeight: 800, color: colors.white, margin: '16px 0 8px', fontFamily: fonts.text }}>
              Modo de Preparo
            </h3>
            <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedRecipe.steps.map((step, i) => (
                <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, fontFamily: fonts.text }}>
                  {step}
                </li>
              ))}
            </ol>

            {/* CTA fixo */}
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
              padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(23,74,64,0.95)', backdropFilter: 'blur(20px)',
              borderTop: `1px solid ${colors.border}`,
            }}>
              <button onClick={() => { handleAddIngredients(selectedRecipe); setSelectedRecipe(null); }} style={{
                width: '100%', padding: 14, borderRadius: 12,
                background: colors.gold, border: 'none', color: colors.bgDeep,
                fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: fonts.text,
                boxShadow: '0 4px 12px rgba(226,184,74,0.4)',
              }}>
                Adicionar {selectedRecipe.ingredients.filter(i => i.productId).length} ingredientes ao carrinho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
