import { format } from 'date-fns';
import { useClock } from '../../hooks/useClock';
import { useSettings } from '../../context/SettingsContext';

export function ClockWidget({ compact = false }: { compact?: boolean }) {
  const { get } = useSettings();
  const clock24 = get<boolean>('display.clock24h', false);
  const showSeconds = get<boolean>('display.showSeconds', false);
  const dateFormat = get<string>('display.dateFormat', 'EEEE, MMMM d');
  const now = useClock(showSeconds);

  const timePattern =
    (clock24 ? 'HH:mm' : 'h:mm') + (showSeconds ? ':ss' : '') + (clock24 ? '' : ' a');

  return (
    <div className={compact ? '' : 'card p-6'}>
      <div
        className={`font-display font-bold tabular-nums text-content ${
          compact ? 'text-4xl' : 'text-6xl'
        }`}
      >
        {format(now, timePattern)}
      </div>
      <div className={`text-content-soft mt-1 ${compact ? 'text-base' : 'text-xl'}`}>
        {format(now, dateFormat)}
      </div>
    </div>
  );
}
