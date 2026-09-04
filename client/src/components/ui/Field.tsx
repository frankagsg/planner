import { type ReactNode } from 'react';

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-bold text-content-soft mb-1.5 uppercase tracking-wide">
        {label}
      </span>
      {children}
      {hint && <span className="block text-sm text-content-faint mt-1">{hint}</span>}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 select-none"
    >
      <span
        className={`w-14 h-8 rounded-full p-1 transition ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : ''
          }`}
        />
      </span>
      {label && <span className="text-lg text-content font-semibold">{label}</span>}
    </button>
  );
}

const SWATCHES = [
  '#e8a0bf', '#e2825a', '#f0b866', '#7cc4a4', '#6cb2e8',
  '#9580e0', '#7aa2f7', '#c98bdb', '#8b7bf6', '#5eb0a0',
];

export const NOTE_SWATCHES = [
  '#fff7ed', '#fef3c7', '#eef7f0', '#f3f0ff', '#fee2e2',
  '#e0f2fe', '#fce7f3', '#f5f5f4',
];

export function ColorPicker({
  value,
  onChange,
  swatches = SWATCHES,
}: {
  value: string;
  onChange: (v: string) => void;
  swatches?: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {swatches.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={`w-11 h-11 rounded-full transition active:scale-90 ${
            value === c ? 'ring-4 ring-accent/40 scale-110' : ''
          }`}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  );
}
