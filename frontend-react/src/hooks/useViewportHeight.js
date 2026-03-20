import { useEffect, useState } from 'react';

export default function useViewportHeight() {
  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window === 'undefined') {
      return 900;
    }
    return window.innerHeight;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return viewportHeight;
}
