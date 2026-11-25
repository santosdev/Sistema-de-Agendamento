import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getMessages } from "@/lib/i18n";

const t = getMessages().auth;

export const metadata: Metadata = { title: t.loginTitle };

export default function LoginPage() {
  return (
    <AuthCard title={t.loginTitle} subtitle={t.loginSubtitle}>
      {/* Reads ?next= and ?error=, so it renders at request time. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
