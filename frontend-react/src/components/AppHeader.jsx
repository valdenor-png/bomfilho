import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, MapPin } from '../icons';
import { useCart } from '../context/CartContext';

export default function AppHeader() {
  const { resumo } = useCart();
  const itemCount = Number(resumo?.itens || 0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header className={`app-header ${scrolled ? 'is-scrolled' : ''}`}>
      <Link to="/" className="app-header-brand" aria-label="Página inicial BomFilho">
        <div className="app-header-logo-icon" aria-hidden="true">
          <ShoppingCart size={18} color="#FFFFFF" strokeWidth={2.5} />
        </div>
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
          <MapPin size={12} strokeWidth={2.5} fill="#E2B84A" color="#E2B84A" />
          Castanhal
        </span>

        <Link to="/pagamento" className={`app-header-cart ${itemCount > 0 ? 'has-items' : ''}`} aria-label={`Carrinho com ${itemCount} itens`}>
          <ShoppingCart size={18} strokeWidth={2} aria-hidden="true" />
          {itemCount > 0 ? (
            <span className="app-header-cart-badge">{itemCount > 99 ? '99+' : itemCount}</span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}
