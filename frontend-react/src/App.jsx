import React from 'react';
import { useEffect, useRef, useState } from 'react';
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
  { to: '/', icon: '🏠', label: 'Home' },
  { to: '/produtos', icon: '🔎', label: 'Busca' },
  { to: '/pedidos', icon: '📦', label: 'Pedidos' },
  { to: '/conta', icon: '👤', label: 'Conta' }
];

export default function App() {
  const { resumo } = useCart();
  const [isDraggingCart, setIsDraggingCart] = useState(false);
  const [suppressCartClick, setSuppressCartClick] = useState(false);
  const [cartPosition, setCartPosition] = useState(() => ({
    x: Math.max(12, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 170),
    y: Math.max(12, (typeof window !== 'undefined' ? window.innerHeight : 768) - (72 + BOTTOM_NAV_SAFE_AREA))
  }));
  const cartRef = useRef(null);
  const dragRef = useRef({
    dragging: false,
    moved: false,
    offsetX: 0,
    offsetY: 0,
    pointerId: null
  });
  const location = useLocation();
  const hostname = window.location.hostname;
  const isLocalHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPedidosRoute = location.pathname.startsWith('/pedidos');

  function limitarPosicao(x, y) {
    const margem = 10;
    const largura = cartRef.current?.offsetWidth || 130;
    const altura = cartRef.current?.offsetHeight || 46;
    const maxX = Math.max(margem, window.innerWidth - largura - margem);
    const maxY = Math.max(margem, window.innerHeight - altura - margem - BOTTOM_NAV_SAFE_AREA);

    return {
      x: Math.min(Math.max(x, margem), maxX),
      y: Math.min(Math.max(y, margem), maxY)
    };
  }

  useEffect(() => {
    function handleResize() {
      setCartPosition((atual) => limitarPosicao(atual.x, atual.y));
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function iniciarArrastoCarrinho(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    dragRef.current.dragging = true;
    dragRef.current.moved = false;
    dragRef.current.offsetX = event.clientX - cartPosition.x;
    dragRef.current.offsetY = event.clientY - cartPosition.y;
    dragRef.current.pointerId = event.pointerId;

    setIsDraggingCart(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moverArrastoCarrinho(event) {
    if (!dragRef.current.dragging) {
      return;
    }

    const novoX = event.clientX - dragRef.current.offsetX;
    const novoY = event.clientY - dragRef.current.offsetY;
    const posicao = limitarPosicao(novoX, novoY);

    if (Math.abs(novoX - cartPosition.x) > 4 || Math.abs(novoY - cartPosition.y) > 4) {
      dragRef.current.moved = true;
    }

    setCartPosition(posicao);
  }

  function finalizarArrastoCarrinho(event) {
    if (!dragRef.current.dragging) {
      return;
    }

    if (dragRef.current.moved) {
      setSuppressCartClick(true);
    }

    dragRef.current.dragging = false;
    setIsDraggingCart(false);
    if (dragRef.current.pointerId !== null) {
      event.currentTarget.releasePointerCapture?.(dragRef.current.pointerId);
      dragRef.current.pointerId = null;
    }
  }

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
          ref={cartRef}
          className={`floating-cart-wrapper ${isDraggingCart ? 'dragging' : ''}`}
          style={{ left: `${cartPosition.x}px`, top: `${cartPosition.y}px` }}
          onPointerDown={iniciarArrastoCarrinho}
          onPointerMove={moverArrastoCarrinho}
          onPointerUp={finalizarArrastoCarrinho}
          onPointerCancel={finalizarArrastoCarrinho}
        >
          <Link
            to="/pagamento"
            className="floating-cart"
            aria-label="Ir para finalizar pedido"
            onClick={(event) => {
              if (suppressCartClick) {
                event.preventDefault();
                setSuppressCartClick(false);
              }
            }}
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
