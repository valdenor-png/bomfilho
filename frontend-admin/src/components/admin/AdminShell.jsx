import React, { useState, useEffect, useCallback, useRef } from 'react';
import { adminGetAlertas } from '../../lib/api';

/* ─── SVG Icon Map ─── */
const ICONS = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  operacao: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  ),
  pedidos: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  ),
  produtos: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  clientes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  importacao: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  financeiro: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  'fin-avancado': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  catalogo: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  relatorios: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  auditoria: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  chevron: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  refresh: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  burger: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
};

/* ─── Navigation Structure ─── */
const NAV_SECTIONS = [
  {
    titulo: 'Visão Geral',
    items: [
      { id: 'dashboard', label: 'Central de Comando', icon: 'dashboard' },
      { id: 'operacao', label: 'Operação ao Vivo', icon: 'operacao' },
    ]
  },
  {
    titulo: 'Gestão',
    collapsible: true,
    defaultOpen: true,
    items: [
      { id: 'pedidos', label: 'Histórico de Pedidos', icon: 'pedidos' },
      { id: 'produtos', label: 'Catálogo', icon: 'produtos' },
      { id: 'clientes', label: 'Clientes', icon: 'clientes' },
      { id: 'importacao', label: 'Importação', icon: 'importacao' },
    ]
  },
  {
    titulo: 'Financeiro',
    collapsible: true,
    defaultOpen: true,
    items: [
      { id: 'financeiro', label: 'Financeiro', icon: 'financeiro' },
      { id: 'fin-avancado', label: 'Financeiro+', icon: 'fin-avancado' },
    ]
  },
  {
    titulo: 'Inteligência',
    collapsible: true,
    defaultOpen: true,
    items: [
      { id: 'catalogo', label: 'Saúde do Catálogo', icon: 'catalogo' },
      { id: 'relatorios', label: 'Relatórios', icon: 'relatorios' },
      { id: 'auditoria', label: 'Auditoria', icon: 'auditoria' },
    ]
  }
];

const TAB_TITLES = {
  dashboard: 'Central de Comando',
  pedidos: 'Histórico de Pedidos',
  produtos: 'Catálogo de Produtos',
  financeiro: 'Painel Financeiro',
  importacao: 'Importação de Produtos',
  operacao: 'Operação ao Vivo',
  clientes: 'Gestão de Clientes',
  'fin-avancado': 'Financeiro Avançado',
  auditoria: 'Auditoria do Sistema',
  relatorios: 'Relatórios e Análises',
  catalogo: 'Saúde do Catálogo',
};

/* ─── Sub-components ─── */

function SidebarBadge({ count, tone }) {
  if (!count || count <= 0) return null;
  return (
    <span className={`sb-badge ${tone || ''}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SidebarItem({ id, label, icon, active, badge, badgeTone, onClick }) {
  return (
    <button
      type="button"
      className={`sb-item${active ? ' is-active' : ''}`}
      onClick={() => onClick(id)}
      aria-current={active ? 'page' : undefined}
    >
      <span className="sb-item-icon">{ICONS[icon] || null}</span>
      <span className="sb-item-label">{label}</span>
      <SidebarBadge count={badge} tone={badgeTone} />
    </button>
  );
}

function SidebarSection({ section, activeTab, badgeCounts, onItemClick }) {
  const hasActiveChild = section.items.some(i => i.id === activeTab);
  const [open, setOpen] = useState(section.defaultOpen !== false || hasActiveChild);

  // Expand when navigating into the section externally
  useEffect(() => {
    if (hasActiveChild && !open) setOpen(true);
  }, [hasActiveChild]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCollapsible = section.collapsible;

  return (
    <div className={`sb-section${open ? ' is-open' : ''}`}>
      {isCollapsible ? (
        <button
          type="button"
          className="sb-section-toggle"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
        >
          <span className="sb-section-title">{section.titulo}</span>
          <span className={`sb-section-chevron${open ? ' is-open' : ''}`}>{ICONS.chevron}</span>
        </button>
      ) : (
        <div className="sb-section-label">
          <span className="sb-section-title">{section.titulo}</span>
        </div>
      )}

      <div className={`sb-section-items${open ? ' is-visible' : ''}`}>
        {section.items.map(item => (
          <SidebarItem
            key={item.id}
            id={item.id}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            badge={badgeCounts[item.id]}
            badgeTone={item.id === 'operacao' || item.id === 'pedidos' ? 'crit' : undefined}
            onClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}

function SidebarStatusPill({ online, alertas, alertasErro }) {
  if (alertasErro) {
    return <span className="sb-status-pill is-dim">Alertas indisponíveis</span>;
  }
  if (!online) {
    return <span className="sb-status-pill is-red">Sem conexão</span>;
  }
  if (alertas.criticos > 0) {
    return <span className="sb-status-pill is-crit">{alertas.criticos} crítico{alertas.criticos > 1 ? 's' : ''}</span>;
  }
  if (alertas.total > 0) {
    return <span className="sb-status-pill is-warn">{alertas.total} alerta{alertas.total > 1 ? 's' : ''}</span>;
  }
  return <span className="sb-status-pill is-ok">Operação normal</span>;
}

/* ─── Main Shell ─── */
export default function AdminShell({ tab, setTab, onLogout, onRefresh, carregando, children }) {
  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [alertasResumo, setAlertasResumo] = useState({ total: 0, criticos: 0 });
  const [relogio, setRelogio] = useState('');
  const [badgeCounts, setBadgeCounts] = useState({});
  const [online, setOnline] = useState(navigator.onLine);
  const [alertasErro, setAlertasErro] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setRelogio(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const carregarAlertas = useCallback(async () => {
    try {
      const data = await adminGetAlertas();
      if (!mountedRef.current) return;
      setAlertasResumo({ total: data.total || 0, criticos: data.criticos || 0 });
      const counts = {};
      if (data.alertas) {
        for (const a of data.alertas) {
          if (a.cta?.tab) {
            counts[a.cta.tab] = (counts[a.cta.tab] || 0) + (a.valor || 1);
          }
        }
      }
      setBadgeCounts(counts);
      setAlertasErro(false);
    } catch {
      if (!mountedRef.current) return;
      setAlertasErro(true);
    }
  }, []);

  useEffect(() => {
    carregarAlertas();
    const interval = setInterval(carregarAlertas, 60000);
    return () => clearInterval(interval);
  }, [carregarAlertas]);

  const fecharSidebar = () => setSidebarAberta(false);

  const handleNavClick = (id) => {
    setTab(id);
    fecharSidebar();
  };

  return (
    <div className="ck-layout">
      {/* Overlay mobile */}
      <div
        className={`ck-overlay${sidebarAberta ? ' show' : ''}`}
        onClick={fecharSidebar}
        role="presentation"
      />

      {/* ──────── Sidebar ──────── */}
      <aside className={`ck-sidebar${sidebarAberta ? ' open' : ''}`}>
        {/* Brand header */}
        <div className="sb-header">
          <div className="sb-brand">
            <img src="/img/logo.svg" alt="BomFilho" style={{ height: 46 }} />
            <span className="sb-brand-tag">ADMIN</span>
          </div>
          <SidebarStatusPill
            online={online}
            alertas={alertasResumo}
            alertasErro={alertasErro}
          />
        </div>

        {/* Navigation */}
        <nav className="sb-nav" aria-label="Navegação principal">
          {NAV_SECTIONS.map((section, si) => (
            <SidebarSection
              key={si}
              section={section}
              activeTab={tab}
              badgeCounts={badgeCounts}
              onItemClick={handleNavClick}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="sb-footer">
          <div className="sb-footer-status">
            <span className={`sb-conn-dot${online ? ' is-on' : ''}`} />
            <span className="sb-conn-label">{online ? 'Conectado' : 'Offline'}</span>
            <span className="sb-conn-clock">{relogio}</span>
          </div>
          <button type="button" className="sb-btn-logout" onClick={onLogout}>
            {ICONS.logout}
            <span>Encerrar sessão</span>
          </button>
        </div>
      </aside>

      {/* ──────── Topbar ──────── */}
      <header className="ck-topbar">
        <button
          type="button"
          className="ck-topbar-burger"
          onClick={() => setSidebarAberta(v => !v)}
          aria-label="Abrir menu"
        >
          {ICONS.burger}
        </button>
        <span className="ck-topbar-title">{TAB_TITLES[tab] || 'Admin'}</span>

        <span className="ck-topbar-spacer" />

        {!online && (
          <span className="ck-topbar-offline-pill">Offline</span>
        )}

        <div className="ck-topbar-alerts">
          {alertasErro ? (
            <span className="ck-topbar-alert-pill dim" title="Falha ao carregar alertas">
              Alertas indisponíveis
            </span>
          ) : alertasResumo.criticos > 0 ? (
            <button type="button" className="ck-topbar-alert-pill crit" onClick={() => setTab('dashboard')}>
              <span className="ck-topbar-pulse crit" />
              {alertasResumo.criticos} crítico{alertasResumo.criticos > 1 ? 's' : ''}
            </button>
          ) : null}
          {!alertasErro && alertasResumo.total > 0 && alertasResumo.total > alertasResumo.criticos ? (
            <button type="button" className="ck-topbar-alert-pill warn" onClick={() => setTab('dashboard')}>
              {alertasResumo.total - alertasResumo.criticos} alerta{alertasResumo.total - alertasResumo.criticos > 1 ? 's' : ''}
            </button>
          ) : null}
          {!alertasErro && alertasResumo.total === 0 ? (
            <span className="ck-topbar-alert-pill ok">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12l4 4 10-10" />
              </svg>
              Tudo OK
            </span>
          ) : null}
        </div>

        <span className="ck-topbar-clock">{relogio}</span>

        <button type="button" className="ck-topbar-refresh" onClick={onRefresh} disabled={carregando}>
          {ICONS.refresh}
          <span>{carregando ? 'Atualizando…' : 'Atualizar'}</span>
        </button>
      </header>

      {/* ──────── Main Content ──────── */}
      <main className="ck-main">
        {children}
      </main>
    </div>
  );
}
