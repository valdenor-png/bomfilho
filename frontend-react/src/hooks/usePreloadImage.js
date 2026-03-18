import { useEffect, useMemo } from 'react';

const preloadRegistry = new Map();

function normalizeSource(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canUseDom() {
  return typeof document !== 'undefined' && Boolean(document.head);
}

function addPreloadLink(src) {
  if (!canUseDom()) {
    return null;
  }

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  link.setAttribute('data-preload-image', 'true');
  document.head.appendChild(link);
  return link;
}

export default function usePreloadImage(src) {
  const normalizedSrc = useMemo(() => normalizeSource(src), [src]);

  useEffect(() => {
    if (!normalizedSrc || !canUseDom()) {
      return undefined;
    }

    const existingEntry = preloadRegistry.get(normalizedSrc);
    if (existingEntry) {
      existingEntry.refCount += 1;
      return () => {
        const entry = preloadRegistry.get(normalizedSrc);
        if (!entry) {
          return;
        }

        entry.refCount -= 1;
        if (entry.refCount <= 0) {
          entry.link?.parentNode?.removeChild(entry.link);
          preloadRegistry.delete(normalizedSrc);
        }
      };
    }

    const link = addPreloadLink(normalizedSrc);
    preloadRegistry.set(normalizedSrc, {
      link,
      refCount: 1
    });

    return () => {
      const entry = preloadRegistry.get(normalizedSrc);
      if (!entry) {
        return;
      }

      entry.refCount -= 1;
      if (entry.refCount <= 0) {
        entry.link?.parentNode?.removeChild(entry.link);
        preloadRegistry.delete(normalizedSrc);
      }
    };
  }, [normalizedSrc]);
}
