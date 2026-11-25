import { cronJson, isCronRequest } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/cron/maintenance: anonymizes guests of meetings that ended more than
 * 12 months ago (RN-65) and clears old rate limit hits. Vercel Cron only.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) return cronJson({ error: "unauthorized" }, 401);
  const { data, error } = await createAdminClient().rpc("run_maintenance");
  if (error) {
    console.error("maintenance failed", error);
    return cronJson({ error: "failed" }, 500);
  }
  return cronJson({ ok: true, anonymized: data });
}
