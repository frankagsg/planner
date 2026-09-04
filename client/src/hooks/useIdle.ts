import { useEffect, useRef, useState } from 'react';

// Fires `idle=true` after `minutes` of no pointer/touch/key activity.
// minutes <= 0 disables idle detection entirely.
export function useIdle(minutes: number): boolean {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!minutes || minutes <= 0) {
      setIdle(false);
      return;
    }
    const ms = minutes * 60 * 1000;
    const reset = () => {
      setIdle(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setIdle(true), ms);
    };
    const events = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [minutes]);

  return idle;
}
