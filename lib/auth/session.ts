import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { avatarUrl } from "@/lib/booking/queries";
import { createClient } from "@/lib/supabase/server";

export type Host = {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  timeZone: string;
  welcomeMessage: string | null;
  isPublic: boolean;
  /** Demo host (RN-66 to RN-73): seed data is protected and some actions are simulated. */
  isDemo: boolean;
};

/**
 * Data Access Layer for the dashboard: the signed-in host and its profile.
 * Redirects to /login without a session. Deduplicated per request.
 */
export const getCurrentHost = cache(async (): Promise<Host> => {
  // Session checks compare token expiry with the clock: always a request-time read.
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path, time_zone, welcome_message, is_public, is_seed")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) redirect("/login");

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarPath: data.avatar_path,
    avatarUrl: avatarUrl(data.avatar_path),
    timeZone: data.time_zone,
    welcomeMessage: data.welcome_message,
    isPublic: data.is_public,
    isDemo: data.is_seed,
  };
});

/** Only same-site paths, so ?next= cannot send the user to another site. */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/** Sign-in e-mail of the current user and a pending change, if any (Profile > Account). */
export async function getAccountEmail(): Promise<{ email: string; pendingEmail: string | null }> {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { email: data.user.email ?? "", pendingEmail: data.user.new_email ?? null };
}
