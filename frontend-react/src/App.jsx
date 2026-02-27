import React from 'react';
import { useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PagamentoPage from './pages/PagamentoPage';
import SobrePage from './pages/SobrePage';
import ContaPage from './pages/ContaPage';
import AdminPage from './pages/AdminPage';
import { useCart } from './context/CartContext';

const links = [
  { to: '/', icon: '🛍️', label: 'Produtos' },
  { to: '/sobre', icon: 'ℹ️', label: 'Sobre' },
  { to: '/conta', icon: '👤', label: 'Conta' }
];

export default function App() {
  const { resumo } = useCart();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const location = useLocation();
  const hostname = window.location.hostname;
  const isLocalHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  const isAdminRoute = location.pathname.startsWith('/admin');

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
    <div className={`app-shell ${sidebarExpanded ? 'sidebar-open' : 'sidebar-closed'}`}>
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pagamento" element={<PagamentoPage />} />
          <Route path="/admin" element={isLocalHost ? <Navigate to="/admin" replace /> : <Navigate to="/" replace />} />
          <Route path="/sobre" element={<SobrePage />} />
          <Route path="/conta" element={<ContaPage />} />
        </Routes>
      </main>

      <button
        type="button"
        aria-label="Fechar menu lateral"
        className={`sidebar-overlay-react ${sidebarExpanded ? 'active' : ''}`}
        onClick={() => setSidebarExpanded(false)}
      />

      {resumo.itens > 0 ? (
        <Link to="/pagamento" className="floating-cart" aria-label="Ir para finalizar pedido">
          <span className="floating-cart-icon">🛒</span>
          <span className="floating-cart-total">R$ {resumo.total.toFixed(2)}</span>
        </Link>
      ) : null}

      <aside className={`sidebar ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`} aria-label="Navegação">
        <div className="sidebar-head-react">
          <button
            type="button"
            className="menu-toggle-react"
            aria-label="Expandir ou recolher menu lateral"
            title="Menu"
            onClick={() => setSidebarExpanded((atual) => !atual)}
          >
            ☰
          </button>
          {sidebarExpanded ? <div className="sidebar-title">Menu</div> : null}
        </div>
        <nav className="sidebar-nav">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => {
                if (window.innerWidth <= 900) {
                  setSidebarExpanded(false);
                }
              }}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </div>
  );
}
