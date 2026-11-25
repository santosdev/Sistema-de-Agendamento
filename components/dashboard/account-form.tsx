"use client";

import { useId, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { describedBy, Field, Input } from "@/components/ui/field";
import { changeEmailAction, changePasswordAction, type AuthResult } from "@/lib/auth/actions";
import { fill, getMessages } from "@/lib/i18n";

const card = "flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-7";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Profile > Account: sign-in e-mail and password. Locked for the demo host (RN-70). */
export function AccountForm({
  email,
  pendingEmail,
  isDemo,
}: {
  email: string;
  pendingEmail: string | null;
  isDemo: boolean;
}) {
  const ta = getMessages().dashboard.profile.account;

  return (
    <section aria-labelledby="account-title" className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="account-title" className="font-display text-heading text-ink">
          {ta.title}
        </h2>
        <p className="text-label text-ink-muted">{ta.subtitle}</p>
      </div>
      {isDemo ? <Alert tone="info">{ta.demoLocked}</Alert> : null}
      <EmailForm email={email} pendingEmail={pendingEmail} disabled={isDemo} />
      <PasswordForm disabled={isDemo} />
    </section>
  );
}

function useAuthAction() {
  const t = getMessages().auth;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<AuthResult>, onOk: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action().catch((): AuthResult => ({ ok: false, error: "unknown" }));
      if (result.ok) onOk();
      else setError(t.errors[result.error]);
    });
  }
  return { error, setError, pending, run };
}

function EmailForm({
  email,
  pendingEmail,
  disabled,
}: {
  email: string;
  pendingEmail: string | null;
  disabled: boolean;
}) {
  const t = getMessages();
  const ta = t.dashboard.profile.account;
  const id = useId();
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [sent, setSent] = useState<string | null>(null);
  const { error, pending, run } = useAuthAction();
  const inputId = `${id}-email`;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSent(null);
    const next = value.trim().toLowerCase();
    const invalid = EMAIL_RE.test(next) ? undefined : t.auth.invalidEmail;
    setFieldError(invalid);
    if (invalid) return;
    run(
      () => changeEmailAction({ email: next }),
      () => {
        setSent(fill(ta.emailSent, { email: next }));
        setValue("");
      },
    );
  }

  return (
    <form noValidate onSubmit={submit} className={card}>
      {error ? <Alert>{error}</Alert> : null}
      {sent ? <Alert tone="success">{sent}</Alert> : null}
      <div className="flex flex-col gap-1">
        <p className="text-label text-ink-secondary">{ta.email}</p>
        <p className="text-body font-semibold break-all text-ink">{email}</p>
        {pendingEmail && !sent ? (
          <p className="text-caption text-ink-muted">{fill(ta.pendingEmail, { email: pendingEmail })}</p>
        ) : null}
      </div>
      <Field id={inputId} label={ta.newEmail} error={fieldError}>
        <Input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          disabled={disabled}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!fieldError || undefined}
          aria-describedby={describedBy(inputId, { error: fieldError })}
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={disabled || !value.trim()}
        className="sm:w-fit"
      >
        {ta.changeEmail}
      </Button>
    </form>
  );
}

function PasswordForm({ disabled }: { disabled: boolean }) {
  const t = getMessages();
  const ta = t.dashboard.profile.account;
  const id = useId();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<{ next?: string; confirm?: string }>({});
  const { error, pending, run } = useAuthAction();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const errors = {
      next: next.length < 8 ? t.auth.passwordTooShort : undefined,
      confirm: confirm !== next ? t.auth.passwordMismatch : undefined,
    };
    setFieldError(errors);
    if (errors.next || errors.confirm || !current) return;
    run(
      () => changePasswordAction({ currentPassword: current, newPassword: next }),
      () => {
        toast(ta.passwordChanged);
        setCurrent("");
        setNext("");
        setConfirm("");
      },
    );
  }

  const ids = { current: `${id}-current`, next: `${id}-next`, confirm: `${id}-confirm` };

  return (
    <form noValidate onSubmit={submit} className={card}>
      {error ? <Alert>{error}</Alert> : null}
      <Field id={ids.current} label={ta.currentPassword}>
        <Input
          id={ids.current}
          type="password"
          autoComplete="current-password"
          disabled={disabled}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <Field id={ids.next} label={ta.newPassword} hint={t.auth.passwordHint} error={fieldError.next}>
        <Input
          id={ids.next}
          type="password"
          autoComplete="new-password"
          disabled={disabled}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-invalid={!!fieldError.next || undefined}
          aria-describedby={describedBy(ids.next, { hint: t.auth.passwordHint, error: fieldError.next })}
        />
      </Field>
      <Field id={ids.confirm} label={t.auth.confirmPassword} error={fieldError.confirm}>
        <Input
          id={ids.confirm}
          type="password"
          autoComplete="new-password"
          disabled={disabled}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!fieldError.confirm || undefined}
          aria-describedby={describedBy(ids.confirm, { error: fieldError.confirm })}
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        loading={pending}
        disabled={disabled || !current || !next}
        className="sm:w-fit"
      >
        {ta.changePassword}
      </Button>
    </form>
  );
}
