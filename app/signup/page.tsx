import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { getMessages } from "@/lib/i18n";

const t = getMessages().auth;

export const metadata: Metadata = { title: t.signupTitle };

export default function SignupPage() {
  return (
    <AuthCard title={t.signupTitle} subtitle={t.signupSubtitle}>
      <SignupForm />
    </AuthCard>
  );
}
