import React from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProdutosPage from './pages/ProdutosPage';
import PagamentoPage from './pages/PagamentoPage';
import PedidosPage from './pages/PedidosPage';
import SobrePage from './pages/SobrePage';
import ContaPage from './pages/ContaPage';
import AdminPage from './pages/AdminPage';
import AdminGerenciaPage from './pages/AdminGerenciaPage';
import PoliticaPrivacidadePage from './pages/PoliticaPrivacidadePage';
import TermosUsoPage from './pages/TermosUsoPage';
import PoliticaTrocaDevolucaoPage from './pages/PoliticaTrocaDevolucaoPage';
import PoliticaEntregaPage from './pages/PoliticaEntregaPage';
import { useCart } from './context/CartContext';

const BOTTOM_NAV_SAFE_AREA = 90;
const WHATSAPP_ATENDIMENTO_URL = 'https://wa.me/5591999652790?text=Ol%C3%A1!%20Quero%20fazer%20um%20pedido.';
const TELEFONE_FIXO_URL = 'tel:+559137219780';

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
            <Route path="/admin" element={isLocalHost ? <AdminPage /> : <Navigate to="/admin/gerencia" replace />} />
            <Route path="/admin/gerencia" element={<AdminGerenciaPage />} />
            <Route path="*" element={<Navigate to="/admin/gerencia" replace />} />
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
          <Route path="/admin" element={<Navigate to="/admin/gerencia" replace />} />
          <Route path="/sobre" element={<SobrePage />} />
          <Route path="/conta" element={<ContaPage />} />
          <Route path="/politica-de-privacidade" element={<PoliticaPrivacidadePage />} />
          <Route path="/termos-de-uso" element={<TermosUsoPage />} />
          <Route path="/politica-de-troca-e-devolucao" element={<PoliticaTrocaDevolucaoPage />} />
          <Route path="/politica-de-entrega" element={<PoliticaEntregaPage />} />
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

      <section className="site-trust-bar" aria-label="Canais de atendimento e links legais">
        <p className="site-trust-contact">
          BomFilho | CNPJ 09.175.211/0001-30 | Endereco: Travessa 07 de Setembro, CEP 68740-180
        </p>
        <p className="site-trust-contact">
          WhatsApp e telefone:{' '}
          <a href={WHATSAPP_ATENDIMENTO_URL} target="_blank" rel="noopener noreferrer">
            (91) 99965-2790
          </a>
          {' '}| Telefone fixo: <a href={TELEFONE_FIXO_URL}>(91) 3721-9780</a>
          {' '}| Segunda a sabado: 7h30 as 13h e 15h as 19h30 | Domingos e feriados: 8h as 12h30
        </p>
        <div className="site-legal-links">
          <Link className="site-legal-link" to="/politica-de-privacidade">Politica de Privacidade</Link>
          <Link className="site-legal-link" to="/termos-de-uso">Termos de Uso</Link>
          <Link className="site-legal-link" to="/politica-de-troca-e-devolucao">Troca e Devolucao</Link>
          <Link className="site-legal-link" to="/politica-de-entrega">Politica de Entrega</Link>
        </div>
      </section>

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
