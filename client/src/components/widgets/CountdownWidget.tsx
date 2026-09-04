import { Sparkles } from 'lucide-react';
import type { Countdown } from '../../types';
import { countdownLabel, daysUntil } from '../../lib/dates';

export function CountdownWidget({ items }: { items: Countdown[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((c) => {
        const days = daysUntil(c.target);
        return (
          <div
            key={c.id}
            className="card p-4 flex flex-col items-center text-center"
            style={{ borderTopColor: c.color, borderTopWidth: 4 }}
          >
            <Sparkles size={20} style={{ color: c.color }} />
            <div className="text-3xl font-display font-bold text-content mt-1 tabular-nums">
              {days >= 0 ? days : '—'}
            </div>
            <div className="text-xs text-content-faint -mt-1">
              {days === 0 ? '' : 'days'}
            </div>
            <div className="text-sm font-semibold text-content-soft mt-1 line-clamp-1">
              {c.label}
            </div>
            <div className="text-xs text-content-faint">{countdownLabel(c.target)}</div>
          </div>
        );
      })}
    </div>
  );
}
