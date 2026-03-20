import { useCallback, useEffect, useState } from 'react';

export default function useElementWidth() {
  const [element, setElement] = useState(null);
  const [width, setWidth] = useState(0);

  const ref = useCallback((node) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) {
      setWidth(0);
      return undefined;
    }

    const updateWidth = () => {
      setWidth(element.clientWidth || 0);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(element);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, [element]);

  return [ref, width];
}
