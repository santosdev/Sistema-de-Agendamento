import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

const t = getMessages().auth;

export const metadata: Metadata = { title: t.resetTitle, robots: { index: false, follow: false } };

/** Reached from the recovery e-mail: /auth/callback has already started the session. */
export default function ResetPasswordPage() {
  return (
    <AuthCard title={t.resetTitle} subtitle={t.resetSubtitle}>
      <Suspense>
        <RequireSession />
      </Suspense>
    </AuthCard>
  );
}

async function RequireSession() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?error=link_invalid");
  return <ResetPasswordForm />;
}
