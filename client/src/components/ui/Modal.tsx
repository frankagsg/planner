import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[92vh] overflow-hidden
                    flex flex-col animate-slide-in sm:animate-fade-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <h2 className="text-2xl font-display font-bold text-content">{title}</h2>
            <button
              className="btn-ghost !min-h-0 !p-2 rounded-full"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={26} />
            </button>
          </div>
        )}
        <div className="px-6 py-5 overflow-y-auto no-scrollbar">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-line flex gap-3 justify-end">{footer}</div>
        )}
      </div>
    </div>
  );
}
