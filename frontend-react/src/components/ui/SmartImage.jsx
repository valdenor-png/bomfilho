import React, { useCallback, useEffect, useState } from 'react';

const IMAGE_CACHE_MAX_ENTRIES = 1200;
const loadedImageSrcCache = new Set();
const loadedImageQueue = [];

function normalizeSource(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function joinClassNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

function hasImageInCache(src) {
  const normalizedSrc = normalizeSource(src);
  return Boolean(normalizedSrc) && loadedImageSrcCache.has(normalizedSrc);
}

function addImageToCache(src) {
  const normalizedSrc = normalizeSource(src);
  if (!normalizedSrc || loadedImageSrcCache.has(normalizedSrc)) {
    return;
  }

  loadedImageSrcCache.add(normalizedSrc);
  loadedImageQueue.push(normalizedSrc);

  while (loadedImageQueue.length > IMAGE_CACHE_MAX_ENTRIES) {
    const oldest = loadedImageQueue.shift();
    if (oldest) {
      loadedImageSrcCache.delete(oldest);
    }
  }
}

const SmartImage = React.forwardRef(function SmartImage(
  {
    src = '',
    alt = '',
    className = '',
    priority = false,
    blurSrc = '',
    fallbackSrc = '',
    loading = 'lazy',
    decoding = 'async',
    onLoad,
    onError,
    ...rest
  },
  ref
) {
  const normalizedSrc = normalizeSource(src);
  const normalizedBlurSrc = normalizeSource(blurSrc);
  const normalizedFallbackSrc = normalizeSource(fallbackSrc);
  const initialSrc = normalizedSrc || normalizedFallbackSrc;

  const [currentSrc, setCurrentSrc] = useState(initialSrc);
  const [hasTriedFallback, setHasTriedFallback] = useState(
    Boolean(!normalizedSrc && normalizedFallbackSrc)
  );
  const [isLoaded, setIsLoaded] = useState(() => Boolean(initialSrc && hasImageInCache(initialSrc)));
  const [hasError, setHasError] = useState(!initialSrc);

  useEffect(() => {
    const nextSrc = normalizedSrc || normalizedFallbackSrc;
    setCurrentSrc(nextSrc);
    setHasTriedFallback(Boolean(!normalizedSrc && normalizedFallbackSrc));
    setIsLoaded(Boolean(nextSrc && hasImageInCache(nextSrc)));
    setHasError(!nextSrc);
  }, [normalizedFallbackSrc, normalizedSrc]);

  const handleLoad = useCallback(
    (event) => {
      addImageToCache(currentSrc);
      addImageToCache(event?.currentTarget?.currentSrc);

      setIsLoaded(true);
      setHasError(false);

      if (typeof onLoad === 'function') {
        onLoad(event);
      }
    },
    [currentSrc, onLoad]
  );

  const handleError = useCallback(
    (event) => {
      const canUseFallback = (
        !hasTriedFallback
        && Boolean(normalizedFallbackSrc)
        && currentSrc !== normalizedFallbackSrc
      );

      if (canUseFallback) {
        setHasTriedFallback(true);
        setCurrentSrc(normalizedFallbackSrc);
        setIsLoaded(Boolean(normalizedFallbackSrc && hasImageInCache(normalizedFallbackSrc)));
        setHasError(false);
        return;
      }

      setHasError(true);

      if (typeof onError === 'function') {
        onError(event);
      }
    },
    [currentSrc, hasTriedFallback, normalizedFallbackSrc, onError]
  );

  const stateClassName = isLoaded
    ? 'smart-image--loaded'
    : hasError
      ? 'smart-image--error'
      : 'smart-image--loading';

  const shouldShowBlurLayer = Boolean(
    normalizedBlurSrc
    && !isLoaded
    && !hasError
    && currentSrc === normalizedSrc
  );

  const mainImageElement = (
    <img
      ref={ref}
      src={currentSrc || undefined}
      alt={alt}
      className={joinClassNames(
        'smart-image',
        stateClassName,
        shouldShowBlurLayer ? 'smart-image-main-layer' : '',
        className
      )}
      loading={priority ? 'eager' : loading}
      decoding={decoding}
      fetchpriority={priority ? 'high' : 'auto'}
      onLoad={handleLoad}
      onError={handleError}
      {...rest}
    />
  );

  if (!shouldShowBlurLayer) {
    return mainImageElement;
  }

  return (
    <span
      className={joinClassNames(
        'smart-image-shell',
        isLoaded ? 'smart-image-shell--loaded' : '',
        hasError ? 'smart-image-shell--error' : ''
      )}
    >
      <img
        src={normalizedBlurSrc}
        alt=""
        aria-hidden="true"
        className={joinClassNames('smart-image-blur-layer', className)}
        loading="eager"
        decoding="async"
        fetchpriority="low"
      />
      {mainImageElement}
    </span>
  );
});

export default SmartImage;
