import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from './context/CartContext';
import ErrorBoundary from './components/ErrorBoundary';
import { getProdutos } from './lib/api';
import { colors } from './theme';

// New design components
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Toast from './components/Toast';
import { getMainCategory } from './lib/formatProductName';
import Home from './pages/Home';
import Products from './pages/Products';
import Orders from './pages/Orders';
import Account from './pages/Account';

// New checkout from prototype
import Checkout from './pages/Checkout';
// Legacy checkout kept as backup
const PagamentoPageLegacy = lazy(() => import('./pages/PagamentoPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminGerenciaPage = lazy(() => import('./pages/AdminGerenciaPage'));
const PedidosPage = lazy(() => import('./pages/PedidosPage'));
const ContaPage = lazy(() => import('./pages/ContaPage'));
const SobrePage = lazy(() => import('./pages/SobrePage'));
const PoliticaPrivacidadePage = lazy(() => import('./pages/PoliticaPrivacidadePage'));
const TermosUsoPage = lazy(() => import('./pages/TermosUsoPage'));
const PoliticaTrocaDevolucaoPage = lazy(() => import('./pages/PoliticaTrocaDevolucaoPage'));
const PoliticaEntregaPage = lazy(() => import('./pages/PoliticaEntregaPage'));

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: colors.textMuted, fontSize: 14,
    }}>
      Carregando...
    </div>
  );
}

export default function App() {
  const { itens, resumo, addItem, updateItemQuantity, removeItem } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const [initialCategory, setInitialCategory] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPagamentoRoute = location.pathname.startsWith('/pagamento');
  const isPedidosRoute = location.pathname.startsWith('/pedidos');
  const isContaRoute = location.pathname.startsWith('/conta');
  const isLegacyRoute = isPagamentoRoute || isPedidosRoute || isContaRoute;

  // Scroll detection for header
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Load products — 10 per main category for fast vitrine
  useEffect(() => {
    const cats = ['bebidas', 'mercearia', 'hortifruti', 'higiene', 'limpeza', 'frios'];
    Promise.all(
      cats.map(cat =>
        getProdutos({ categoria: cat, limit: 10, page: 1 })
          .then(data => (data.produtos || []))
          .catch(() => [])
      )
    ).then(results => {
      const all = results.flat().map(p => ({
        id: Number(p.id),
        name: p.nome || p.name || '',
        description: p.descricao || p.description || '',
        price: Number(p.preco || p.price || 0),
        oldPrice: Number(p.preco_anterior || p.oldPrice || 0) || null,
        category: getMainCategory(p.categoria || p.category || ''),
        tag: p.promocao || Number(p.desconto || 0) > 0 ? 'Oferta' : null,
        image_url: p.imagem || p.image_url || '',
      }));
      // Dedup by id
      const seen = new Set();
      const deduped = all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      setProducts(deduped);
    });
  }, []);

  // Search function — queries API directly for full catalog
  const searchProducts = useCallback(async (term) => {
    if (!term || term.length < 2) return [];
    try {
      const data = await getProdutos({ busca: term, limit: 20 });
      return (data.produtos || []).map(p => ({
        id: Number(p.id),
        name: p.nome || p.name || '',
        description: p.descricao || p.description || '',
        price: Number(p.preco || p.price || 0),
        oldPrice: Number(p.preco_anterior || p.oldPrice || 0) || null,
        category: getMainCategory(p.categoria || p.category || ''),
        tag: p.promocao || Number(p.desconto || 0) > 0 ? 'Oferta' : null,
        image_url: p.imagem || p.image_url || '',
      }));
    } catch { return []; }
  }, []);

  // Convert CartContext items to simple cart object {id: qty}
  const cart = useMemo(() => {
    const obj = {};
    (itens || []).forEach((item) => {
      obj[item.id] = Number(item.quantidade || 1);
    });
    return obj;
  }, [itens]);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((x) => x.id === Number(id));
    return sum + (p ? p.price * qty : 0);
  }, 0);

  // Handlers
  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setToastVisible(true);
  }, []);

  const handleAdd = useCallback((id) => {
    const product = products.find((p) => p.id === Number(id));
    if (product) {
      addItem({
        id: product.id,
        nome: product.name,
        preco: product.price,
        imagem: product.image_url,
        categoria: product.category,
      });
      showToast(`${product.name.split(' ').slice(0, 3).join(' ')} adicionado`);
    }
  }, [products, addItem, showToast]);

  const handleRemove = useCallback((id) => {
    removeItem(Number(id));
  }, [removeItem]);

  const handleGoProducts = useCallback((cat) => {
    setInitialCategory(cat || null);
    navigate('/produtos');
    window.scrollTo(0, 0);
  }, [navigate]);

  const handleGoCategory = useCallback((catId) => {
    handleGoProducts(catId);
  }, [handleGoProducts]);

  const handleCartClick = useCallback(() => {
    navigate('/pagamento');
  }, [navigate]);

  // Current active tab for BottomNav
  const activeTab = location.pathname === '/' ? 'home'
    : location.pathname.startsWith('/produtos') ? 'produtos'
    : location.pathname.startsWith('/pedidos') ? 'pedidos'
    : location.pathname.startsWith('/conta') ? 'conta'
    : 'home';

  const handleTabChange = useCallback((tab) => {
    const routes = { home: '/', produtos: '/produtos', pedidos: '/pedidos', conta: '/conta' };
    navigate(routes[tab] || '/');
    window.scrollTo(0, 0);
  }, [navigate]);

  // Admin routes — keep legacy
  if (isAdminRoute) {
    return (
      <ErrorBoundary resetKeys={[location.pathname]}>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/gerencia" element={<AdminGerenciaPage />} />
            <Route path="*" element={<Navigate to="/admin/gerencia" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Main app shell
  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      background: `linear-gradient(180deg, ${colors.bg} 0%, ${colors.bgDark} 100%)`,
      minHeight: '100vh',
      color: colors.white,
      position: 'relative',
      maxWidth: 480,
      overflowX: 'hidden',
      margin: '0 auto',
    }}>
      {/* Header — hide on checkout */}
      {!isPagamentoRoute ? (
        <Header cartCount={cartCount} onCartClick={handleCartClick} scrolled={scrolled} />
      ) : null}

      {/* Main content */}
      <main style={{ paddingBottom: 72 }}>
        <ErrorBoundary resetKeys={[location.pathname]}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* New design pages */}
              <Route path="/" element={
                <Home
                  cart={cart}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  onGoProducts={handleGoProducts}
                  onGoCategory={handleGoCategory}
                  products={products}
                />
              } />
              <Route path="/produtos" element={
                <Products
                  cart={cart}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  products={products}
                  initialCategory={initialCategory}
                  onSearch={searchProducts}
                />
              } />
              <Route path="/pedidos" element={<Orders />} />
              <Route path="/conta" element={<Account />} />

              {/* New checkout from prototype */}
              <Route path="/pagamento" element={
                <Checkout
                  cart={cart}
                  products={products}
                  updateQty={(id, qty) => {
                    if (qty <= 0) {
                      removeItem(Number(id));
                    } else {
                      updateItemQuantity(Number(id), qty);
                    }
                  }}
                  removeItem={handleRemove}
                  onGoHome={() => { navigate('/'); window.scrollTo(0, 0); }}
                />
              } />
              <Route path="/sobre" element={<SobrePage />} />
              <Route path="/politica-de-privacidade" element={<PoliticaPrivacidadePage />} />
              <Route path="/termos-de-uso" element={<TermosUsoPage />} />
              <Route path="/politica-de-troca-e-devolucao" element={<PoliticaTrocaDevolucaoPage />} />
              <Route path="/politica-de-entrega" element={<PoliticaEntregaPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Toast */}
      <Toast message={toastMsg} visible={toastVisible} onHide={() => setToastVisible(false)} />

      {/* WhatsApp flutuante — centralizado dentro do max-width */}
      {!isPagamentoRoute ? (
        <div style={{
          position: 'fixed', bottom: 72, left: 0, right: 0,
          zIndex: 180, pointerEvents: 'none',
          display: 'flex', justifyContent: 'flex-end',
          maxWidth: 480, margin: '0 auto', paddingRight: 16, boxSizing: 'border-box',
        }}>
          <a href="https://wa.me/5591999652790" target="_blank" rel="noopener noreferrer" style={{
            width: 48, height: 48, borderRadius: '50%', background: '#25D366',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(37,211,102,0.35)', textDecoration: 'none',
            pointerEvents: 'auto',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFF">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.216l-.256-.154-2.892.86.86-2.892-.154-.256A8 8 0 1112 20z"/>
            </svg>
          </a>
        </div>
      ) : null}

      {/* Bottom nav — hide on checkout */}
      {!isPagamentoRoute ? (
        <BottomNav active={activeTab} onNavigate={handleTabChange} />
      ) : null}
    </div>
  );
}
