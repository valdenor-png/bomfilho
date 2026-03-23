import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { useCart } from './context/CartContext';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalCartBar from './components/GlobalCartBar';
import {
  STORE_NAME,
  STORE_CNPJ,
  STORE_CEP,
  STORE_ENDERECO,
  STORE_HORARIO,
  STORE_WHATSAPP_DISPLAY,
  STORE_WHATSAPP_URL,
  STORE_TELEFONE_DISPLAY,
  STORE_TELEFONE_URL
} from './config/store';

const loadProdutosPage = () => import('./pages/ProdutosPage');
const loadPagamentoPage = () => import('./pages/PagamentoPage');
const loadPedidosPage = () => import('./pages/PedidosPage');
const loadSobrePage = () => import('./pages/SobrePage');
const loadContaPage = () => import('./pages/ContaPage');
const loadAdminPage = () => import('./pages/AdminPage');
const loadAdminGerenciaPage = () => import('./pages/AdminGerenciaPage');
const loadPoliticaPrivacidadePage = () => import('./pages/PoliticaPrivacidadePage');
const loadTermosUsoPage = () => import('./pages/TermosUsoPage');
const loadPoliticaTrocaDevolucaoPage = () => import('./pages/PoliticaTrocaDevolucaoPage');
const loadPoliticaEntregaPage = () => import('./pages/PoliticaEntregaPage');

const ProdutosPage = lazy(loadProdutosPage);
const PagamentoPage = lazy(loadPagamentoPage);
const PedidosPage = lazy(loadPedidosPage);
const SobrePage = lazy(loadSobrePage);
const ContaPage = lazy(loadContaPage);
const AdminPage = lazy(loadAdminPage);
const AdminGerenciaPage = lazy(loadAdminGerenciaPage);
const PoliticaPrivacidadePage = lazy(loadPoliticaPrivacidadePage);
const TermosUsoPage = lazy(loadTermosUsoPage);
const PoliticaTrocaDevolucaoPage = lazy(loadPoliticaTrocaDevolucaoPage);
const PoliticaEntregaPage = lazy(loadPoliticaEntregaPage);

function podePrefetchNavegacao() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) {
    return true;
  }

  if (connection.saveData) {
    return false;
  }

  const effectiveType = String(connection.effectiveType || '').toLowerCase();
  return !effectiveType.includes('2g');
}

function agendarEmIdle(callback, timeout = 1200) {
  if (typeof window === 'undefined') {
    callback();
    return () => {};
  }

  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const timer = window.setTimeout(callback, 280);
  return () => window.clearTimeout(timer);
}

function RouteLoadingFallback({ message = 'Carregando pagina...' }) {
  return (
    <section className="route-loading-fallback" role="status" aria-live="polite">
      <div className="route-loading-card">
        <p className="route-loading-title">Aguarde um instante</p>
        <p className="route-loading-copy">{message}</p>
      </div>
    </section>
  );
}

const links = [
  { to: '/', icon: '🏠', label: 'Início' },
  { to: '/produtos', icon: '🔎', label: 'Produtos' },
  { to: '/pedidos', icon: '📦', label: 'Pedidos' },
  { to: '/conta', icon: '👤', label: 'Conta' }
];

export default function App() {
  const { resumo } = useCart();
  const location = useLocation();
  const [checkoutContext, setCheckoutContext] = useState(null);
  const hostname = window.location.hostname;
  const isLocalHost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isProdutosRoute = location.pathname.startsWith('/produtos');
  const isPagamentoRoute = location.pathname.startsWith('/pagamento');
  const mostrarBottomNavCliente = !isAdminRoute;
  const podeMostrarBarraGlobalCarrinho = Number(resumo?.itens || 0) > 0;

  useEffect(() => {
    function handleCheckoutContextEvent(event) {
      setCheckoutContext(event?.detail || null);
    }

    window.addEventListener('bomfilho:checkout-context', handleCheckoutContextEvent);
    return () => window.removeEventListener('bomfilho:checkout-context', handleCheckoutContextEvent);
  }, []);

  useEffect(() => {
    if (!isPagamentoRoute) {
      setCheckoutContext(null);
    }
  }, [isPagamentoRoute]);

  useEffect(() => {
    if (!podePrefetchNavegacao()) {
      return undefined;
    }

    return agendarEmIdle(() => {
      void loadProdutosPage();
    }, 1700);
  }, []);

  useEffect(() => {
    if (resumo.itens <= 0 || !podePrefetchNavegacao()) {
      return undefined;
    }

    return agendarEmIdle(() => {
      void loadPagamentoPage();
    }, 1200);
  }, [resumo.itens]);

  if (isAdminRoute) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback message="Carregando area administrativa..." />}>
          <Routes>
            <Route path="/admin" element={isLocalHost ? <AdminPage /> : <Navigate to="/admin/gerencia" replace />} />
            <Route path="/admin/gerencia" element={<AdminGerenciaPage />} />
            <Route path="*" element={<Navigate to="/admin/gerencia" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-to-content">Pular para o conteúdo</a>
      <main className={`content${isProdutosRoute ? ' content-produtos' : ''}${podeMostrarBarraGlobalCarrinho ? ' has-global-cart-bar' : ''}${mostrarBottomNavCliente ? ' has-bottom-nav' : ''}`} id="main-content">
        <ErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/produtos" element={<ProdutosPage />} />
            <Route path="/pagamento" element={<PagamentoPage />} />
            <Route path="/pedidos" element={<PedidosPage />} />
            <Route path="/admin" element={<Navigate to="/admin/gerencia" replace />} />
            <Route path="/sobre" element={<SobrePage />} />
            <Route path="/conta" element={<ContaPage />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidadePage />} />
            <Route path="/termos-de-uso" element={<TermosUsoPage />} />
            <Route path="/politica-de-troca-e-devolucao" element={<PoliticaTrocaDevolucaoPage />} />
            <Route path="/politica-de-entrega" element={<PoliticaEntregaPage />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      <GlobalCartBar
        visible={podeMostrarBarraGlobalCarrinho}
        resumo={resumo}
        isCheckoutRoute={isPagamentoRoute}
        hasBottomNav={mostrarBottomNavCliente}
        checkoutContext={checkoutContext}
        onCheckoutPrimaryAction={() => {
          window.dispatchEvent(new CustomEvent('bomfilho:checkout-primary-action'));
        }}
      />

      <section className="site-trust-bar" aria-label="Canais de atendimento e links legais">
        <p className="site-trust-contact">
          {STORE_NAME} | CNPJ {STORE_CNPJ} | Endereco: {STORE_ENDERECO}
        </p>
        <p className="site-trust-contact">
          WhatsApp e telefone:{' '}
          <a href={STORE_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            {STORE_WHATSAPP_DISPLAY}
          </a>
          {' '}| Telefone fixo: <a href={STORE_TELEFONE_URL}>{STORE_TELEFONE_DISPLAY}</a>
          {' '}| {STORE_HORARIO}
        </p>
        <div className="site-legal-links">
          <Link className="site-legal-link" to="/politica-de-privacidade">Politica de Privacidade</Link>
          <Link className="site-legal-link" to="/termos-de-uso">Termos de Uso</Link>
          <Link className="site-legal-link" to="/politica-de-troca-e-devolucao">Troca e Devolucao</Link>
          <Link className="site-legal-link" to="/politica-de-entrega">Politica de Entrega</Link>
        </div>
      </section>

      {mostrarBottomNavCliente ? (
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
      ) : null}

    </div>
  );
}
