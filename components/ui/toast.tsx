"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { getMessages } from "@/lib/i18n";

type Tone = "success" | "error";
type Toast = { id: number; message: string; tone: Tone };
type ShowToast = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ShowToast | null>(null);

const DURATION_MS = 4500;
const MAX_VISIBLE = 3;

/**
 * Short confirmations ("Alterações salvas.") that do not move the layout.
 * Errors stay as inline alerts next to the form; toasts are for success.
 * The region is always in the DOM so screen readers announce new messages.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const reduceMotion = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, tone = "success") => {
      const id = ++nextId.current;
      setToasts((list) =>
        [...list.filter((t) => t.message !== message), { id, message, tone }].slice(-MAX_VISIBLE),
      );
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const label = getMessages().dashboard.dismiss;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout={!reduceMotion}
              role={t.tone === "error" ? "alert" : "status"}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-control border bg-surface py-3 pr-2 pl-4 text-label shadow-pop",
                t.tone === "error" ? "border-danger/20 text-danger" : "border-border text-ink",
              )}
            >
              {t.tone === "error" ? (
                <CircleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
              ) : (
                <CircleCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-success-ink" />
              )}
              <p className="flex-1 py-px">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label={label}
                className="-my-1 inline-flex size-8 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-surface-soft hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** Shows a toast. Outside the provider (tests, isolated renders) it is a no-op. */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  return useMemo(() => show ?? (() => {}), [show]);
}
