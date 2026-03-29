import React, { useState, useEffect } from 'react';
import { ADMIN_COLORS as C } from './ui/adminTheme';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';

/**
 * AdminLayout — Wrapper principal do admin.
 *
 * Uso no seu Router:
 * ─────────────────
 * import AdminLayout from './components/admin/AdminLayout';
 *
 * <Route path="/admin" element={<AdminLayout />}>
 *   <Route index element={<CentralDeComando />} />
 *   <Route path="operacao" element={<OperacaoAoVivo />} />
 *   <Route path="pedidos" element={<HistoricoPedidos />} />
 *   ...
 * </Route>
 *
 * Ou sem nested routes:
 * ─────────────────────
 * <AdminLayout
 *   title="Central de Comando"
 *   activeKey="comando"
 * >
 *   <CentralDeComando />
 * </AdminLayout>
 *
 * Props:
 * - title: string — título mostrado na topbar
 * - activeKey: string — key do item ativo na sidebar
 * - onNavigate: (path, key) => void — callback de navegação
 * - badges: { [key]: string } — badges de notificação
 * - userName: string
 * - children: React.ReactNode — conteúdo da página
 */
export default function AdminLayout({
  title = 'Admin',
  activeKey = 'comando',
  onNavigate,
  badges = {},
  userName = 'Admin',
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Relógio
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="admin-root">
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeKey={activeKey}
        onNavigate={(path, key) => {
          setSidebarOpen(false);
          if (onNavigate) onNavigate(path, key);
        }}
        badges={badges}
        userName={userName}
        currentTime={currentTime}
      />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AdminTopbar
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
          onRefresh={() => window.location.reload()}
          currentTime={currentTime}
          statusOk={true}
        />

        <div
          className="admin-page-enter"
          style={{
            padding: '20px 20px 40px',
            maxWidth: 960,
            width: '100%',
            margin: '0 auto',
            flex: 1,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
