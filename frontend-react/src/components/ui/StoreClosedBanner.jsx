import React, { useState, useEffect } from 'react';
import { getStoreStatus } from '../../lib/storeHours';
import { colors, fonts } from '../../theme';

export default function StoreClosedBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const update = () => setStatus(getStoreStatus());
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!status || (status.isOpen && !status.closingSoon)) return null;

  const isClosed = !status.isOpen;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', fontSize: 12, fontWeight: 600,
      fontFamily: fonts.text,
      background: isClosed ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.12)',
      borderBottom: `1px solid ${isClosed ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.2)'}`,
      color: isClosed ? '#FCA5A5' : '#FBBF24',
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{isClosed ? '\u{1F512}' : '\u23F0'}</span>
      <div>
        {isClosed && <strong style={{ display: 'block', fontSize: 12 }}>Estamos fechados</strong>}
        <span style={{ fontSize: 11, opacity: 0.85 }}>{status.message}</span>
      </div>
    </div>
  );
}
