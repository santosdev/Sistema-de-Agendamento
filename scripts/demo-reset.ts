/**
 * Creates (if needed) the demo host and rebuilds its data (RN-66 to RN-72).
 *
 *   npm run demo:reset
 *
 * Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
 * DEMO_USER_EMAIL, DEMO_USER_PASSWORD. In production the same reset runs daily
 * through the Vercel cron (app/api/cron/demo-reset).
 */
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resetDemo } from "../lib/demo/reset";
import type { Database } from "../lib/supabase/database.types";

const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(1),
    DEMO_USER_EMAIL: z.email(),
    DEMO_USER_PASSWORD: z.string().min(12),
  })
  .parse(process.env);

// Wrapped in a function: package.json has no "type": "module", so tsx runs this as CommonJS.
async function main() {
  const admin = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userId = await resetDemo(admin, { email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD });
  console.log(`Demo pronto: usuário ${env.DEMO_USER_EMAIL} (${userId}), perfil /marina-demo`);
}

main().catch((error: unknown) => {
  console.error("Falha no reset do demo:", error instanceof Error ? error.message : error);
  process.exit(1);
});
