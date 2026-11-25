import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env/public";
import type { Database } from "./database.types";

/**
 * Cookie-less anon client for public pages (host profile, booking page, slots).
 * Reads only what RLS exposes to anon. Does not touch cookies, so it does not
 * tie public pages to the visitor session.
 */
export function createPublicClient() {
  const env = publicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
