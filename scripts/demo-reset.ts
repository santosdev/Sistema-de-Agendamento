/**
 * Creates (if needed) the demo host and rebuilds its data (RN-66 to RN-72).
 *
 *   npm run demo:reset
 *
 * Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
 * DEMO_USER_EMAIL, DEMO_USER_PASSWORD.
 */
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SECRET_KEY: z.string().min(1),
    DEMO_USER_EMAIL: z.email(),
    DEMO_USER_PASSWORD: z.string().min(12),
  })
  .parse(process.env);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(email: string): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 1000) return undefined;
  }
}

async function ensureDemoUser(): Promise<string> {
  const existing = await findUserIdByEmail(env.DEMO_USER_EMAIL);

  if (existing) {
    // Keep the password in sync with .env.local so "Entrar como anfitrião demo" works.
    const { error } = await admin.auth.admin.updateUserById(existing, { password: env.DEMO_USER_PASSWORD });
    if (error) throw error;
    return existing;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: env.DEMO_USER_EMAIL,
    password: env.DEMO_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { name: "Marina Alves", time_zone: "America/Sao_Paulo" },
  });
  if (error) throw error;
  return data.user.id;
}

// Wrapped in a function: package.json has no "type": "module", so tsx runs this as CommonJS.
async function main() {
  const userId = await ensureDemoUser();
  const { error } = await admin.rpc("seed_demo", { p_host_id: userId });
  if (error) throw error;

  console.log(`Demo pronto: usuário ${env.DEMO_USER_EMAIL} (${userId}), perfil /marina-demo`);
}

main().catch((error: unknown) => {
  console.error("Falha no reset do demo:", error instanceof Error ? error.message : error);
  process.exit(1);
});
