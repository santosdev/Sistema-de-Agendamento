import { cronJson, isCronRequest } from "@/lib/cron";
import { resetDemo } from "@/lib/demo/reset";
import { serverEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/cron/demo-reset: daily demo reset (RN-72). Vercel Cron only. */
export async function GET(request: Request) {
  if (!isCronRequest(request)) return cronJson({ error: "unauthorized" }, 401);
  try {
    const env = serverEnv();
    await resetDemo(createAdminClient(), { email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD });
    return cronJson({ ok: true });
  } catch (error) {
    console.error("demo reset failed", error);
    return cronJson({ error: "failed" }, 500);
  }
}
