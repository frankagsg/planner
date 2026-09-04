import { format } from 'date-fns';
import { CloudOff, Droplets, Wind } from 'lucide-react';
import { useResource } from '../../hooks/useResource';
import { useSettings } from '../../context/SettingsContext';
import type { Weather } from '../../types';
import { WeatherIcon } from '../WeatherIcon';

export function WeatherWidget({ full = false }: { full?: boolean }) {
  const { get } = useSettings();
  const enabled = get<boolean>('weather.enabled', true);
  const { data, loading } = useResource<Weather>('/weather', []);

  if (!enabled) return null;

  const unavailable = !loading && (!data || data.available === false || !data.current);

  if (unavailable) {
    return (
      <div className="card p-6 flex items-center gap-3 text-content-soft">
        <CloudOff size={28} />
        <div>
          <div className="font-semibold text-content">Weather unavailable</div>
          <div className="text-sm">Check your connection or provider settings.</div>
        </div>
      </div>
    );
  }

  if (loading && !data?.current) {
    return <div className="card p-6 animate-pulse h-32" />;
  }

  const c = data!.current!;
  const unit = data!.location?.units === 'metric' ? 'C' : 'F';

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-content-soft font-semibold">
            {data!.location?.label || 'Weather'}
            {data!.stale && <span className="ml-2 text-xs text-amber-500">(last known)</span>}
          </div>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-6xl font-display font-bold text-content">{c.temp}°</span>
            <span className="text-content-soft mb-2">{c.text}</span>
          </div>
          <div className="text-content-soft mt-1">Feels like {c.feelsLike}°{unit}</div>
        </div>
        <WeatherIcon icon={c.icon} size={64} className="text-accent" />
      </div>

      <div className="flex gap-5 mt-3 text-content-soft text-sm">
        <span className="flex items-center gap-1.5">
          <Droplets size={16} /> {c.humidity}%
        </span>
        <span className="flex items-center gap-1.5">
          <Wind size={16} /> {c.wind}
        </span>
      </div>

      {full && data!.hourly && (
        <div className="flex gap-4 mt-5 overflow-x-auto no-scrollbar">
          {data!.hourly.map((h) => (
            <div key={h.time} className="flex flex-col items-center gap-1 min-w-[3.5rem]">
              <span className="text-xs text-content-faint">{format(new Date(h.time), 'ha')}</span>
              <WeatherIcon icon={h.icon} size={26} className="text-accent" />
              <span className="font-bold text-content">{h.temp}°</span>
              {h.precipProb != null && h.precipProb > 0 && (
                <span className="text-[10px] text-sky-500">{h.precipProb}%</span>
              )}
            </div>
          ))}
        </div>
      )}

      {full && data!.daily && (
        <div className="mt-5 space-y-2">
          {data!.daily.slice(0, 6).map((d) => (
            <div key={d.date} className="flex items-center gap-4">
              <span className="w-16 text-content-soft">{format(new Date(d.date), 'EEE')}</span>
              <WeatherIcon icon={d.icon} size={24} className="text-accent" />
              {d.precipProb != null && d.precipProb > 0 ? (
                <span className="text-xs text-sky-500 w-10">{d.precipProb}%</span>
              ) : (
                <span className="w-10" />
              )}
              <div className="flex-1" />
              <span className="font-bold text-content">{d.hi}°</span>
              <span className="text-content-faint">{d.lo}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
