import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { Modal } from './Modal';

/* -------------------------------- Toasts -------------------------------- */
type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/* ------------------------------- Confirm -------------------------------- */
interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface FeedbackCtx {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
}

const Ctx = createContext<FeedbackCtx | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<
    (ConfirmOpts & { resolve: (v: boolean) => void }) | null
  >(null);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
    []
  );

  const closeConfirm = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  const iconFor = (k: ToastKind) =>
    k === 'success' ? (
      <CheckCircle2 className="text-emerald-500" />
    ) : k === 'error' ? (
      <AlertTriangle className="text-rose-500" />
    ) : (
      <Info className="text-accent" />
    );

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card px-4 py-3 flex items-center gap-3 shadow-card animate-fade-up min-w-[16rem]"
          >
            {iconFor(t.kind)}
            <span className="text-content font-semibold flex-1">{t.message}</span>
            <button
              className="text-content-faint"
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      <Modal
        open={!!confirmState}
        onClose={() => closeConfirm(false)}
        title={confirmState?.title}
        footer={
          <>
            <button className="btn-ghost" onClick={() => closeConfirm(false)}>
              Cancel
            </button>
            <button
              className={confirmState?.danger ? 'btn-danger' : 'btn-primary'}
              onClick={() => closeConfirm(true)}
            >
              {confirmState?.confirmLabel || 'Confirm'}
            </button>
          </>
        }
      >
        <p className="text-lg text-content-soft">{confirmState?.message}</p>
      </Modal>
    </Ctx.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}
