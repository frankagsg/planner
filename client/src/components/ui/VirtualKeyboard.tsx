import { useEffect, useRef, useState } from 'react';
import { Delete, ArrowBigUp, X, CornerDownLeft, Space } from 'lucide-react';

/**
 * In-app touch keyboard for kiosk use (most reliable approach on Pi OS).
 * - Appears when a text input / textarea gains focus.
 * - Docks to the bottom; the app shell adds bottom padding while it's open so
 *   the focused field is never permanently hidden (it also scrolls into view).
 * - Writes directly into the focused element and dispatches an `input` event so
 *   React's controlled components update.
 *
 * Enable per field with `data-vkeyboard` (default on for text/search/textarea).
 */

type Target = HTMLInputElement | HTMLTextAreaElement;

const ROWS_LOWER = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
const ROWS_UPPER = ROWS_LOWER.map((r) => r.map((k) => k.toUpperCase()));

function isEditable(el: Element | null): el is Target {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return el.getAttribute('data-vkeyboard') !== 'off';
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    const textLike = ['text', 'search', 'email', 'url', 'tel', 'number', 'password', ''];
    if (!textLike.includes(type)) return false;
    return el.getAttribute('data-vkeyboard') !== 'off';
  }
  return false;
}

function setNativeValue(el: Target, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function VirtualKeyboard() {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(false);
  const targetRef = useRef<Target | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element;
      if (isEditable(el)) {
        targetRef.current = el;
        setOpen(true);
        // Ensure the field isn't hidden behind the keyboard.
        setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      // Delay so taps on the keyboard don't immediately close it.
      const related = e.relatedTarget as Element | null;
      if (related?.closest('[data-vk-root]')) return;
      setTimeout(() => {
        if (!document.activeElement || !isEditable(document.activeElement)) {
          setOpen(false);
          targetRef.current = null;
        }
      }, 120);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // Toggle a body class so the layout can reserve space for the keyboard.
  useEffect(() => {
    document.body.classList.toggle('vk-open', open);
    return () => document.body.classList.remove('vk-open');
  }, [open]);

  if (!open) return null;

  const rows = shift ? ROWS_UPPER : ROWS_LOWER;

  const press = (key: string) => {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + key + el.value.slice(end);
    setNativeValue(el, next);
    const pos = start + key.length;
    requestAnimationFrame(() => el.setSelectionRange(pos, pos));
    el.focus();
    if (shift) setShift(false);
  };

  const backspace = () => {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (start === end && start > 0) {
      const next = el.value.slice(0, start - 1) + el.value.slice(end);
      setNativeValue(el, next);
      requestAnimationFrame(() => el.setSelectionRange(start - 1, start - 1));
    } else if (start !== end) {
      const next = el.value.slice(0, start) + el.value.slice(end);
      setNativeValue(el, next);
      requestAnimationFrame(() => el.setSelectionRange(start, start));
    }
    el.focus();
  };

  const enter = () => {
    const el = targetRef.current;
    if (el instanceof HTMLTextAreaElement) press('\n');
    else {
      el?.blur();
      setOpen(false);
    }
  };

  const Key = ({
    children,
    onTap,
    grow = 1,
    variant = 'default',
  }: {
    children: React.ReactNode;
    onTap: () => void;
    grow?: number;
    variant?: 'default' | 'accent' | 'muted';
  }) => (
    <button
      type="button"
      // Prevent the field from losing focus on pointer down.
      onPointerDown={(e) => e.preventDefault()}
      onClick={onTap}
      style={{ flexGrow: grow, flexBasis: 0 }}
      className={`h-14 rounded-xl text-xl font-semibold flex items-center justify-center
        active:scale-95 transition select-none
        ${
          variant === 'accent'
            ? 'bg-accent text-white'
            : variant === 'muted'
            ? 'bg-surface-raised text-content-soft'
            : 'bg-surface-card text-content border border-line'
        }`}
    >
      {children}
    </button>
  );

  return (
    <div
      data-vk-root
      className="fixed inset-x-0 bottom-0 z-50 bg-surface/95 backdrop-blur border-t border-line
                 px-2 pb-2 pt-2 shadow-card animate-slide-in kiosk-nosel"
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-1.5 justify-center">
            {i === 3 && (
              <Key onTap={() => setShift((s) => !s)} grow={1.5} variant={shift ? 'accent' : 'muted'}>
                <ArrowBigUp />
              </Key>
            )}
            {row.map((k) => (
              <Key key={k} onTap={() => press(k)}>
                {k}
              </Key>
            ))}
            {i === 3 && (
              <Key onTap={backspace} grow={1.5} variant="muted">
                <Delete />
              </Key>
            )}
          </div>
        ))}
        <div className="flex gap-1.5">
          <Key onTap={() => press('@')} variant="muted">@</Key>
          <Key onTap={() => press('.')} variant="muted">.</Key>
          <Key onTap={() => press(' ')} grow={6} variant="muted">
            <Space /> <span className="ml-2 text-base">space</span>
          </Key>
          <Key onTap={enter} grow={2} variant="accent">
            <CornerDownLeft />
          </Key>
          <Key
            onTap={() => {
              targetRef.current?.blur();
              setOpen(false);
            }}
            variant="muted"
          >
            <X />
          </Key>
        </div>
      </div>
    </div>
  );
}
