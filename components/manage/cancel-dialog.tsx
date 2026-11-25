"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { fill, getMessages } from "@/lib/i18n";

type Props = {
  open: boolean;
  hostName: string;
  pending: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
};

/**
 * DESIGN.md 7.12: destructive confirmation. Native <dialog> gives focus trapping,
 * Esc to close and focus return to the opener.
 */
export function CancelDialog({ open, hostName, pending, error, onConfirm, onClose }: Props) {
  const t = getMessages().manage.cancelDialog;
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="cancel-title"
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40"
    >
      <form
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(reason);
        }}
        className="flex flex-col gap-5 p-6"
      >
        <div className="flex flex-col gap-2">
          <h2 id="cancel-title" className="font-display text-heading text-ink">
            {fill(t.title, { name: hostName })}
          </h2>
          <p className="text-label text-ink-muted">{fill(t.body, { name: hostName })}</p>
        </div>

        {error ? <Alert>{error}</Alert> : null}

        <Field
          id="cancel-reason"
          label={t.reasonLabel}
          optionalLabel={getMessages().common.optional}
          hint={fill(t.reasonHint, { name: hostName })}
        >
          <Textarea
            id="cancel-reason"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-describedby="cancel-reason-hint"
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t.keep}
          </Button>
          <Button type="submit" variant="danger-solid" loading={pending}>
            {t.confirm}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
