import { useEffect, useState } from 'react';

export default function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebounced(value);
    }, Math.max(0, Number(delayMs) || 0));

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return debounced;
}
