import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { onConnectivity, isOnline } from '../lib/api';

// Subtle, non-alarming offline indicator. Auto-hides when back online.
export function OfflineBadge() {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const off = onConnectivity(setOnline);
    const onNative = () => setOnline(navigator.onLine);
    window.addEventListener('online', onNative);
    window.addEventListener('offline', onNative);
    return () => {
      off();
      window.removeEventListener('online', onNative);
      window.removeEventListener('offline', onNative);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30
                    chip bg-amber-100 text-amber-800 shadow-soft px-4 py-2 text-base">
      <WifiOff size={18} />
      Offline — showing saved data
    </div>
  );
}
