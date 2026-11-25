import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/** Prefix of every event type the E2E suite creates (see dashboard.spec.ts). */
export const E2E_EVENT_PREFIX = "E2E ";

/**
 * Removes event types left by the E2E suite on the demo host, so the public demo page
 * stays clean even when a test fails before deleting what it created.
 * Runs before and after the suite (playwright.config.ts). Only touches non-seed events
 * of the demo host whose title starts with the prefix.
 */
export default async function cleanupE2eEvents() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.warn("[e2e cleanup] skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY missing");
    return;
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: hosts, error: hostError } = await admin.from("profiles").select("id").eq("is_seed", true);
  if (hostError) throw hostError;
  const hostIds = (hosts ?? []).map((h) => h.id);
  if (hostIds.length === 0) return;

  const { data, error } = await admin
    .from("event_types")
    .delete()
    .in("host_id", hostIds)
    .eq("is_seed", false)
    .like("title", `${E2E_EVENT_PREFIX}%`)
    .select("id");
  if (error) throw error;
  if (data.length > 0) console.log(`[e2e cleanup] removed ${data.length} leftover event type(s)`);
}
