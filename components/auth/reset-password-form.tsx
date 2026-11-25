"use client";

import { useId, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import { setNewPasswordAction } from "@/lib/auth/actions";
import { getMessages } from "@/lib/i18n";

export function ResetPasswordForm() {
  const t = getMessages().auth;
  const id = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const errors = {
      password: password.length < 8 ? t.passwordTooShort : undefined,
      confirm: confirm !== password ? t.passwordMismatch : undefined,
    };
    setFieldError(errors);
    if (errors.password || errors.confirm) return;
    startTransition(async () => {
      // Redirects to the dashboard on success.
      const result = await setNewPasswordAction({ password }).catch(() => null);
      if (!result?.ok) setError(t.errors[result?.ok === false ? result.error : "unknown"]);
    });
  }

  const passwordId = `${id}-password`;
  const confirmId = `${id}-confirm`;

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}
      <Field id={passwordId} label={t.newPassword} hint={t.passwordHint} error={fieldError.password}>
        <Input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fieldError.password || undefined}
          aria-describedby={describedBy(passwordId, { hint: t.passwordHint, error: fieldError.password })}
        />
      </Field>
      <Field id={confirmId} label={t.confirmPassword} error={fieldError.confirm}>
        <Input
          id={confirmId}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!fieldError.confirm || undefined}
          aria-describedby={describedBy(confirmId, { error: fieldError.confirm })}
        />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {pending ? t.resetSaving : t.resetSubmit}
      </Button>
    </form>
  );
}
