import React, { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#DC2626', color: '#fff',
      padding: '8px 16px', textAlign: 'center',
      fontSize: 12, fontWeight: 700,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      Sem conexao com a internet
    </div>
  );
}
