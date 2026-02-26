import { NavLink, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PagamentoPage from './pages/PagamentoPage';
import SobrePage from './pages/SobrePage';
import ContaPage from './pages/ContaPage';

const links = [
  { to: '/', icon: '🏠', label: 'Início' },
  { to: '/sobre', icon: 'ℹ️', label: 'Sobre' },
  { to: '/conta', icon: '👤', label: 'Conta' }
];

export default function App() {
  return (
    <div className="app-shell">
      <main className="content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pagamento" element={<PagamentoPage />} />
          <Route path="/sobre" element={<SobrePage />} />
          <Route path="/conta" element={<ContaPage />} />
        </Routes>
      </main>

      <aside className="sidebar sidebar-expanded" aria-label="Navegação">
        <div className="sidebar-title">Menu</div>
        <nav className="sidebar-nav">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
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
