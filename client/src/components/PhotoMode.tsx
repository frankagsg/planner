import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { X } from 'lucide-react';
import { useClock } from '../hooks/useClock';
import { useResource } from '../hooks/useResource';
import { useSettings } from '../context/SettingsContext';
import type { PersonalPayload } from '../types';

// A selectable full-screen photo frame. Reuses the same personal photos +
// interval as the screensaver, but is user-invoked (button) rather than idle-
// triggered. A slim clock overlay keeps it glanceable. Touch anywhere exits.
export function PhotoMode({ onExit }: { onExit: () => void }) {
  const { get } = useSettings();
  const clock24 = get<boolean>('display.clock24h', false);
  const now = useClock(false);
  const { data: personal } = useResource<PersonalPayload>('/personal', []);
  const photos = personal?.photos ?? [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const interval = (personal?.config?.photo_interval ?? 8) * 1000;
    const t = setInterval(() => setIdx((i) => (i + 1) % photos.length), interval);
    return () => clearInterval(t);
  }, [photos, personal]);

  const timeFmt = clock24 ? 'HH:mm' : 'h:mm a';

  return (
    <div
      className="fixed inset-0 z-[70] bg-black text-white flex items-center justify-center kiosk-nosel overflow-hidden"
      onPointerDown={onExit}
    >
      {photos.length === 0 ? (
        <div className="text-center px-8">
          <p className="text-3xl font-display mb-3">No photos yet</p>
          <p className="text-lg opacity-70">
            Drop images into <code>client/public/photos</code> to fill the frame.
          </p>
          <p className="text-sm opacity-50 mt-8">Touch anywhere to exit</p>
        </div>
      ) : (
        <>
          {photos.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                i === idx ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-8 left-8 text-left">
            <div className="text-6xl font-display font-bold tabular-nums drop-shadow">
              {format(now, timeFmt)}
            </div>
            <div className="text-2xl font-display opacity-90 drop-shadow">
              {format(now, 'EEEE, MMMM d')}
            </div>
          </div>
        </>
      )}

      <button
        className="absolute top-6 right-6 bg-white/15 hover:bg-white/25 rounded-full p-3 backdrop-blur"
        onClick={(e) => {
          e.stopPropagation();
          onExit();
        }}
        aria-label="Exit photo mode"
      >
        <X size={28} />
      </button>
    </div>
  );
}
