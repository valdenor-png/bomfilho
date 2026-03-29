import React from 'react';

export function SkeletonLine({ width = '100%', height = 12, style }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width, height, borderRadius: 6,
        background: 'rgba(255,255,255,0.08)',
        position: 'relative', overflow: 'hidden',
        ...style,
      }}
    />
  );
}

export function SkeletonProductCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden', height: 180,
    }}>
      <SkeletonLine width="100%" height={90} style={{ borderRadius: 0 }} />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonLine width="80%" height={14} />
        <SkeletonLine width="50%" height={18} />
      </div>
    </div>
  );
}

export function SkeletonOrderCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <SkeletonLine width={100} height={16} />
        <SkeletonLine width={80} height={16} />
      </div>
      <SkeletonLine width="60%" height={12} />
      <SkeletonLine width="40%" height={12} />
    </div>
  );
}

// CSS injected once
export function SkeletonStyles() {
  return (
    <style>{`
      .skeleton-shimmer { position: relative; overflow: hidden; }
      .skeleton-shimmer::after {
        content: '';
        position: absolute;
        top: 0; right: 0; bottom: 0; left: 0;
        transform: translateX(-100%);
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
        animation: skeletonShimmer 1.3s infinite;
      }
      @keyframes skeletonShimmer { 100% { transform: translateX(100%); } }
    `}</style>
  );
}
