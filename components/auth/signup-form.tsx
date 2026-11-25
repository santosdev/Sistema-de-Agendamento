"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field, Input } from "@/components/ui/field";
import { signUpAction } from "@/lib/auth/actions";
import { fill, getMessages } from "@/lib/i18n";

export function SignupForm() {
  const t = getMessages().auth;
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t.nameRequired).max(80),
        email: z.string().trim().pipe(z.email(t.invalidEmail)),
        password: z.string().min(8, t.passwordTooShort).max(72),
      }),
    [t],
  );
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), mode: "onTouched" });
  const [error, setError] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (confirmFor) {
    return (
      <Alert tone="success">
        <strong className="block font-semibold">{t.checkEmailTitle}</strong>
        {fill(t.checkEmailBody, { email: confirmFor })}
      </Alert>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        setError(null);
        startTransition(async () => {
          // RN-09: the profile time zone defaults to the browser one.
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const result = await signUpAction({ ...values, timeZone });
          if (!result) return;
          if (!result.ok) setError(t.errors[result.error]);
          else if (result.needsConfirmation) setConfirmFor(getValues("email").trim());
        });
      })}
      className="flex flex-col gap-4"
    >
      {error ? <Alert>{error}</Alert> : null}
      <Field id="signup-name" label={t.name} error={errors.name?.message}>
        <Input
          id="signup-name"
          autoComplete="name"
          aria-invalid={!!errors.name || undefined}
          aria-describedby={describedBy("signup-name", { error: errors.name?.message })}
          {...register("name")}
        />
      </Field>
      <Field id="signup-email" label={t.email} error={errors.email?.message}>
        <Input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          aria-invalid={!!errors.email || undefined}
          aria-describedby={describedBy("signup-email", { error: errors.email?.message })}
          {...register("email")}
        />
      </Field>
      <Field id="signup-password" label={t.password} hint={t.passwordHint} error={errors.password?.message}>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password || undefined}
          aria-describedby={describedBy("signup-password", {
            hint: t.passwordHint,
            error: errors.password?.message,
          })}
          {...register("password")}
        />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {pending ? t.signingUp : t.signUp}
      </Button>
      <p className="text-center text-label text-ink-secondary">
        {t.hasAccount}{" "}
        <Link href="/login" className="font-semibold text-brand underline-offset-2 hover:underline">
          {t.goToLogin}
        </Link>
      </p>
    </form>
  );
}
