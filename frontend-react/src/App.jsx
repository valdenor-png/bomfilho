import React from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProdutosPage from './pages/ProdutosPage';
import PagamentoPage from './pages/PagamentoPage';
import PedidosPage from './pages/PedidosPage';
import SobrePage from './pages/SobrePage';
import ContaPage from './pages/ContaPage';
import AdminPage from './pages/AdminPage';
import { useCart } from './context/CartContext';

const BOTTOM_NAV_SAFE_AREA = 90;

const links = [
  { to: '/', icon: '🏠', label: 'Início' },
  { to: '/produtos', icon: '🔎', label: 'Produtos' },
  { to: '/pedidos', icon: '📦', label: 'Pedidos' },
  { to: '/conta', icon: '👤', label: 'Conta' }
];

export default function App() {
  const { resumo } = useCart();
  const location = useLocation();
  const hostname = window.location.hostname;
  const isLocalHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPedidosRoute = location.pathname.startsWith('/pedidos');

  if (isAdminRoute) {
    return (
      <div className="app-shell admin-shell">
        <main className="content admin-content">
          <Routes>
            <Route path="/admin" element={isLocalHost ? <AdminPage /> : <Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/produtos" element={<ProdutosPage />} />
          <Route path="/pagamento" element={<PagamentoPage />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/admin" element={isLocalHost ? <Navigate to="/admin" replace /> : <Navigate to="/" replace />} />
          <Route path="/sobre" element={<SobrePage />} />
          <Route path="/conta" element={<ContaPage />} />
        </Routes>
      </main>

      {resumo.itens > 0 && !isPedidosRoute ? (
        <div
          className="floating-cart-wrapper"
          style={{ right: '12px', bottom: `${BOTTOM_NAV_SAFE_AREA + 10}px` }}
        >
          <Link
            to="/pagamento"
            className="floating-cart"
            aria-label="Ir para o checkout"
          >
            <span className="floating-cart-icon">🛒</span>
            <span className="floating-cart-total">R$ {resumo.total.toFixed(2)}</span>
          </Link>
        </div>
      ) : null}

      <nav className="bottom-nav" aria-label="Navegação principal">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `bottom-nav-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
