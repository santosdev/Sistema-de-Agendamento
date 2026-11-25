"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { demoSignInAction, magicLinkAction, signInAction, type AuthResult } from "@/lib/auth/actions";
import { fill, getMessages } from "@/lib/i18n";

type Mode = "password" | "magic";

export function LoginForm() {
  const t = getMessages().auth;
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") === "link_invalid" ? t.errors.link_invalid : null,
  );
  const [sent, setSent] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [demoPending, startDemo] = useTransition();

  // Server actions redirect on success; only failures come back here.
  function handle(result: AuthResult | undefined, onOk?: () => void) {
    if (!result) return;
    if (result.ok) onOk?.();
    else setError(t.errors[result.error]);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(null);
    startTransition(async () => {
      if (mode === "password") {
        handle(await signInAction({ email, password, next }));
      } else {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        handle(await magicLinkAction({ email, timeZone, next }), () =>
          setSent(fill(t.magicLinkSent, { email: email.trim() })),
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? <Alert>{error}</Alert> : null}
      {sent ? <Alert tone="success">{sent}</Alert> : null}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field id="login-email" label={t.email}>
          <Input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        {mode === "password" ? (
          <Field id="login-password" label={t.password}>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        ) : null}
        <Button type="submit" size="lg" loading={pending} className="w-full">
          {mode === "password"
            ? pending
              ? t.signingIn
              : t.signIn
            : pending
              ? t.magicLinkSending
              : t.magicLinkSubmit}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setMode(mode === "password" ? "magic" : "password");
            setError(null);
            setSent(null);
          }}
        >
          {mode === "password" ? t.magicLink : t.usePassword}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-caption text-ink-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-divider" />
        {t.or}
        <span className="h-px flex-1 bg-divider" />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="lg"
          loading={demoPending}
          icon={<FlaskConical aria-hidden="true" className="size-[18px]" />}
          onClick={() => {
            setError(null);
            startDemo(async () => handle(await demoSignInAction()));
          }}
          aria-describedby="demo-hint"
          className="w-full"
        >
          {t.demo}
        </Button>
        <p id="demo-hint" className="text-center text-caption text-ink-muted">
          {t.demoHint}
        </p>
      </div>

      <p className="text-center text-label text-ink-secondary">
        {t.noAccount}{" "}
        <Link href="/signup" className="font-semibold text-brand underline-offset-2 hover:underline">
          {t.createAccount}
        </Link>
      </p>
    </div>
  );
}
