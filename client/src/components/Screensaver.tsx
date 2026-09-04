import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useClock } from '../hooks/useClock';
import { useSettings } from '../context/SettingsContext';
import { useResource } from '../hooks/useResource';
import type { Weather, PersonalPayload } from '../types';
import { WeatherIcon } from './WeatherIcon';

// Full-screen ambient mode after inactivity: large clock/date, weather, and
// (optionally) rotating personal photos. Touch anywhere dismisses it.
export function Screensaver({ onDismiss }: { onDismiss: () => void }) {
  const { get } = useSettings();
  const clock24 = get<boolean>('display.clock24h', false);
  const type = get<string>('display.screensaverType', 'clock');
  const now = useClock(false);
  const { data: weather } = useResource<Weather>('/weather', []);
  const { data: personal } = useResource<PersonalPayload>('/personal', []);
  const photos = personal?.photos ?? [];
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    if (type !== 'photos' || photos.length === 0) return;
    const interval = (personal?.config?.photo_interval ?? 8) * 1000;
    const t = setInterval(() => setPhotoIdx((i) => (i + 1) % photos.length), interval);
    return () => clearInterval(t);
  }, [type, photos, personal]);

  const timeFmt = clock24 ? 'HH:mm' : 'h:mm';
  const showPhotos = type === 'photos' && photos.length > 0;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black text-white flex items-center justify-center kiosk-nosel overflow-hidden"
      onPointerDown={onDismiss}
    >
      {showPhotos &&
        photos.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              i === photoIdx ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      {showPhotos && <div className="absolute inset-0 bg-black/40" />}

      <div className="relative text-center px-8">
        <div className="text-[10rem] leading-none font-display font-bold tabular-nums">
          {format(now, timeFmt)}
          {!clock24 && (
            <span className="text-5xl ml-4 align-top opacity-80">{format(now, 'a')}</span>
          )}
        </div>
        <div className="text-4xl font-display mt-4 opacity-90">
          {format(now, 'EEEE, MMMM d')}
        </div>

        {weather?.current && (
          <div className="mt-10 flex items-center justify-center gap-4 text-3xl opacity-90">
            <WeatherIcon icon={weather.current.icon} size={48} />
            <span className="font-bold">{weather.current.temp}°</span>
            <span className="opacity-80">{weather.current.text}</span>
          </div>
        )}

        <div className="mt-12 text-lg opacity-50">Touch anywhere to wake</div>
      </div>
    </div>
  );
}
