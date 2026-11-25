"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { isValidTimeZone } from "@/lib/scheduling/time";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "./session";

export type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_exists"
  | "weak_password"
  | "rate_limited"
  | "invalid_input"
  | "same_password"
  | "wrong_password"
  | "same_email"
  | "demo_locked"
  | "not_authenticated"
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
    case "same_password":
      return "same_password";
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
  // Local scope: only this browser. The demo account is shared, so a global sign-out would
  // end every other visitor's session.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

/**
 * Forgot password. Always answers ok, so the form does not reveal which addresses have an account.
 * The link opens /auth/callback, which starts a recovery session and sends the user to /reset-password.
 */
export async function requestPasswordResetAction(input: unknown): Promise<AuthResult> {
  const parsed = z.object({ email }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl("/reset-password"),
  });
  if (error && toAuthError(error) === "rate_limited") return { ok: false, error: "rate_limited" };
  return { ok: true };
}

/** The signed-in account and whether it is the demo host (RN-70: its credentials never change). */
async function currentAccount() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return { supabase, user: null, isDemo: false } as const;
  const { data: profile } = await supabase.from("profiles").select("is_seed").eq("id", user.id).maybeSingle();
  return { supabase, user: { id: user.id, email: user.email }, isDemo: profile?.is_seed ?? false } as const;
}

/** Sets a new password after the recovery link (/reset-password). */
export async function setNewPasswordAction(input: unknown): Promise<AuthResult> {
  const parsed = z.object({ password }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, user, isDemo } = await currentAccount();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (isDemo) return { ok: false, error: "demo_locked" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: toAuthError(error) };
  redirect("/dashboard?password=updated");
}

/** Checks a password on a cookie-less client, so the browser session is not replaced. */
async function passwordMatches(address: string, value: string): Promise<boolean> {
  const { error } = await createPublicClient().auth.signInWithPassword({ email: address, password: value });
  return !error;
}

/** Profile > Account: changes the password. The current one is asked again. */
export async function changePasswordAction(input: unknown): Promise<AuthResult> {
  const parsed = z
    .object({ currentPassword: z.string().min(1).max(72), newPassword: password })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, user, isDemo } = await currentAccount();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (isDemo) return { ok: false, error: "demo_locked" };
  if (!(await passwordMatches(user.email, parsed.data.currentPassword))) {
    return { ok: false, error: "wrong_password" };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
  if (error) return { ok: false, error: toAuthError(error) };
  return { ok: true };
}

/**
 * Profile > Account: starts an e-mail change. Supabase sends a confirmation link
 * (to both addresses when "secure email change" is on); the change applies after it.
 */
export async function changeEmailAction(input: unknown): Promise<AuthResult> {
  const parsed = z.object({ email }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { supabase, user, isDemo } = await currentAccount();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (isDemo) return { ok: false, error: "demo_locked" };
  if (parsed.data.email === user.email.toLowerCase()) return { ok: false, error: "same_email" };

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: callbackUrl("/dashboard/profile?email=confirmed") },
  );
  if (error) return { ok: false, error: toAuthError(error) };
  return { ok: true, needsConfirmation: true };
}
