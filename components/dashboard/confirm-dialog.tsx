"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/** Destructive confirmation (DESIGN.md 7.12). Native <dialog>: focus trap, Esc, focus return. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      onClose={onClose}
      onCancel={(e) => pending && e.preventDefault()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <h2 id="confirm-title" className="font-display text-heading text-ink">
            {title}
          </h2>
          <p id="confirm-body" className="text-label text-ink-muted">
            {body}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant="danger-solid" loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
