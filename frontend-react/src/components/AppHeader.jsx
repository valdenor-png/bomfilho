import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, MapPin } from '../icons';
import { useCart } from '../context/CartContext';

export default function AppHeader() {
  const { resumo } = useCart();
  const itemCount = Number(resumo?.itens || 0);

  return (
    <header className="app-header">
      <Link to="/" className="app-header-brand" aria-label="Página inicial BomFilho">
        <div className="app-header-logo-icon" aria-hidden="true">🛒</div>
        <div className="app-header-logo-text">
          <span className="app-header-logo-name">
            <span className="app-header-logo-bom">Bom</span>
            <span className="app-header-logo-filho">Filho</span>
          </span>
          <span className="app-header-logo-sub">SUPERMERCADO</span>
        </div>
      </Link>

      <div className="app-header-right">
        <span className="app-header-location">
          <MapPin size={14} strokeWidth={2.5} aria-hidden="true" />
          Castanhal
        </span>

        <Link to="/pagamento" className="app-header-cart" aria-label={`Carrinho com ${itemCount} itens`}>
          <ShoppingCart size={20} strokeWidth={2} aria-hidden="true" />
          {itemCount > 0 ? (
            <span className="app-header-cart-badge">{itemCount > 99 ? '99+' : itemCount}</span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
