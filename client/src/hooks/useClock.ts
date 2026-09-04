import { useEffect, useState } from 'react';

// A shared ticking clock. `withSeconds` controls tick frequency to save CPU.
export function useClock(withSeconds = false) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = withSeconds ? 1000 : 15000;
    // Align first tick to the next boundary for accuracy.
    let timer: ReturnType<typeof setInterval>;
    const align = withSeconds ? 1000 - (Date.now() % 1000) : 1000;
    const t = setTimeout(() => {
      setNow(new Date());
      timer = setInterval(() => setNow(new Date()), interval);
    }, align);
    return () => {
      clearTimeout(t);
      if (timer) clearInterval(timer);
    };
  }, [withSeconds]);
  return now;
}
