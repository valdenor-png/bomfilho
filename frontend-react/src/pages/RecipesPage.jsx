import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { colors, fonts, formatProductName } from '../theme';
import Icon from '../components/Icon';
import { recipes } from '../data/recipes';

const categoryFilters = ['Todos', 'Cafe da Manha', 'Almoco', 'Lanche', 'Jantar', 'Sobremesa'];

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{recipe.emoji}</div>
                {recipe.region && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: 'rgba(226,184,74,0.85)',
                    background: 'rgba(226,184,74,0.1)', border: '1px solid rgba(226,184,74,0.2)',
                    borderRadius: 8, padding: '3px 8px', fontFamily: fonts.text,
                  }}>{recipe.region}</span>
                )}
              </div>
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

      {/* Recipe detail modal — portaled to body so position:fixed works */}
      {selectedRecipe && createPortal(
        <div onClick={() => setSelectedRecipe(null)} style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'bf-overlay-in 0.25s ease',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: `linear-gradient(180deg, ${colors.bgDark || '#174A40'} 0%, ${colors.bgDeep || '#133D35'} 100%)`,
            borderRadius: '22px 22px 0 0',
            border: `1px solid rgba(255,255,255,0.08)`,
            borderBottom: 'none',
            padding: '0 16px 90px',
            animation: 'bf-sheet-up 0.35s cubic-bezier(.32,.72,0,1)',
          }}>
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 14px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 28 }}>{selectedRecipe.emoji}</span>
                  {selectedRecipe.region && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: 'rgba(226,184,74,0.85)',
                      background: 'rgba(226,184,74,0.1)', border: '1px solid rgba(226,184,74,0.2)',
                      borderRadius: 8, padding: '3px 8px', fontFamily: fonts.text,
                    }}>{selectedRecipe.region}</span>
                  )}
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: colors.white, margin: 0, fontFamily: fonts.text }}>
                  {selectedRecipe.title}
                </h2>
                <p style={{ fontSize: 12, color: colors.textMuted, margin: '4px 0 0', lineHeight: 1.4, fontFamily: fonts.text }}>
                  {selectedRecipe.description}
                </p>
              </div>
              <button onClick={() => setSelectedRecipe(null)} style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginLeft: 8,
                background: 'rgba(255,255,255,0.07)', border: `1px solid rgba(255,255,255,0.08)`,
                color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="close" size={14} color="rgba(255,255,255,0.5)" />
              </button>
            </div>

            {/* Meta pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { label: `${selectedRecipe.prep_time + selectedRecipe.cook_time}min`, icon: 'clock' },
                { label: `${selectedRecipe.servings} porcoes`, icon: 'user' },
                { label: selectedRecipe.difficulty === 'facil' ? 'Facil' : selectedRecipe.difficulty === 'medio' ? 'Medio' : 'Dificil' },
              ].map((m, i) => (
                <span key={i} style={{
                  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8, padding: '4px 10px', fontFamily: fonts.text,
                }}>{m.label}</span>
              ))}
            </div>

            {/* Ingredientes */}
            <h3 style={{ fontSize: 13, fontWeight: 800, color: colors.white, margin: '0 0 8px', fontFamily: fonts.text }}>
              Ingredientes
            </h3>
            <div style={{
              background: 'rgba(255,255,255,0.03)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.05)', padding: '4px 12px', marginBottom: 16,
            }}>
              {selectedRecipe.ingredients.map((ing, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
                  borderBottom: i < selectedRecipe.ingredients.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  fontSize: 12, color: colors.white, fontFamily: fonts.text,
                  opacity: ing.productId ? 1 : 0.5,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: ing.productId ? colors.success : 'rgba(255,255,255,0.2)',
                  }} />
                  <span style={{ flex: 1 }}>{ing.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: fonts.number }}>
                    {ing.quantity}
                  </span>
                </div>
              ))}
            </div>

            {/* Modo de preparo */}
            <h3 style={{ fontSize: 13, fontWeight: 800, color: colors.white, margin: '0 0 8px', fontFamily: fonts.text }}>
              Modo de Preparo
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {selectedRecipe.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                    background: 'rgba(226,184,74,0.1)', border: '1px solid rgba(226,184,74,0.15)',
                    color: colors.gold, fontSize: 10, fontWeight: 800, fontFamily: fonts.number,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, margin: 0, fontFamily: fonts.text }}>
                    {step}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA fixo */}
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
              padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(19,61,53,0.95)', backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              zIndex: 9991,
            }}>
              <button onClick={() => { handleAddIngredients(selectedRecipe); setSelectedRecipe(null); }} style={{
                width: '100%', padding: 14, borderRadius: 12,
                background: `linear-gradient(135deg, ${colors.gold} 0%, #C9A03A 100%)`,
                border: 'none', color: colors.bgDeep,
                fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: fonts.text,
                boxShadow: '0 4px 16px rgba(226,184,74,0.35)',
              }}>
                Adicionar {selectedRecipe.ingredients.filter(i => i.productId).length} ingredientes ao carrinho
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
