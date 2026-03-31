import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';

const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminGerenciaPage = lazy(() => import('./pages/AdminGerenciaPage'));
const NotaSeparacao = lazy(() => import('./pages/NotaSeparacao'));

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: '#8BADA3', fontSize: 14,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      background: '#0B1F1A',
    }}>
      Carregando...
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <ErrorBoundary resetKeys={[location.pathname]}>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/gerencia" element={<AdminGerenciaPage />} />
          <Route path="/admin/pedido/:id/separacao" element={<NotaSeparacao />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
