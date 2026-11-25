"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { fill, getMessages } from "@/lib/i18n";

export function ForgotPasswordForm() {
  const t = getMessages().auth;
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email }).catch(() => null);
      if (result?.ok) setSent(fill(t.forgotSent, { email: email.trim() }));
      else setError(t.errors[result?.error ?? "unknown"]);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? <Alert>{error}</Alert> : null}
      {sent ? <Alert tone="success">{sent}</Alert> : null}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field id={`${id}-email`} label={t.email}>
          <Input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          {pending ? t.forgotSending : t.forgotSubmit}
        </Button>
      </form>

      <p className="text-center text-label">
        <Link href="/login" className="font-semibold text-brand underline-offset-2 hover:underline">
          {t.backToLogin}
        </Link>
      </p>
    </div>
  );
}
