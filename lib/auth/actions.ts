"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { isValidTimeZone } from "@/lib/scheduling/time";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "./session";

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_exists"
  | "weak_password"
  | "rate_limited"
  | "invalid_input"
  | "unknown";

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; error: AuthErrorCode };

const email = z.string().trim().toLowerCase().pipe(z.email());
const password = z.string().min(8).max(72);

function toAuthError(error: { code?: string; message?: string } | null): AuthErrorCode {
  switch (error?.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_already_exists":
    case "email_exists":
      return "user_exists";
    case "weak_password":
      return "weak_password";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    default:
      console.error("auth failed", error);
      return "unknown";
  }
}

function callbackUrl(next: string) {
  return `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** E-mail and password (RN-01). Redirects on success. */
export async function signInAction(input: unknown): Promise<AuthResult> {
  const parsed = z
    .object({ email, password: z.string().min(1).max(72), next: z.string().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: toAuthError(error) };
  redirect(safeNext(parsed.data.next));
}

/** Magic link (RN-01). Also creates the account on first use. */
export async function magicLinkAction(input: unknown): Promise<AuthResult> {
  const parsed = z
    .object({ email, timeZone: z.string().optional(), next: z.string().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const timeZone =
    parsed.data.timeZone && isValidTimeZone(parsed.data.timeZone) ? parsed.data.timeZone : undefined;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: callbackUrl(safeNext(parsed.data.next)),
      data: timeZone ? { time_zone: timeZone } : undefined,
    },
  });
  if (error) return { ok: false, error: toAuthError(error) };
  return { ok: true };
}

/** Open sign-up (RN-01, RN-02, RN-09). The profile is created by a database trigger. */
export async function signUpAction(input: unknown): Promise<AuthResult> {
  const parsed = z
    .object({ name: z.string().trim().min(1).max(80), email, password, timeZone: z.string() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const { name, timeZone } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: callbackUrl("/dashboard"),
      data: { name, time_zone: isValidTimeZone(timeZone) ? timeZone : "America/Sao_Paulo" },
    },
  });
  if (error) return { ok: false, error: toAuthError(error) };
  // With e-mail confirmation on, an existing address returns a user without identities.
  if (data.user && data.user.identities?.length === 0) return { ok: false, error: "user_exists" };
  if (!data.session) return { ok: true, needsConfirmation: true };
  redirect("/dashboard");
}

/** RN-67: one-click demo login. The password never reaches the browser. */
export async function demoSignInAction(): Promise<AuthResult> {
  const env = serverEnv();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: env.DEMO_USER_EMAIL,
    password: env.DEMO_USER_PASSWORD,
  });
  if (error) return { ok: false, error: toAuthError(error) };
  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
