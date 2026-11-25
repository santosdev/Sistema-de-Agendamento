import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getMessages } from "@/lib/i18n";

const t = getMessages().auth;

export const metadata: Metadata = { title: t.forgotTitle };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title={t.forgotTitle} subtitle={t.forgotSubtitle}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
