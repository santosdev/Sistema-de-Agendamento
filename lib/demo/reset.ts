import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

async function findUserIdByEmail(admin: Admin, email: string): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 1000) return undefined;
  }
}

/**
 * Creates the demo host if needed, keeps its password in sync and rebuilds its data
 * with dates relative to today (RN-66 to RN-72). Used by `npm run demo:reset` and the daily cron.
 * No "server-only" import: the CLI script runs outside Next.js.
 */
export async function resetDemo(admin: Admin, creds: { email: string; password: string }): Promise<string> {
  let userId = await findUserIdByEmail(admin, creds.email);

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password: creds.password });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: creds.email,
      password: creds.password,
      email_confirm: true,
      user_metadata: { name: "Marina Alves", time_zone: "America/Sao_Paulo" },
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const { error } = await admin.rpc("seed_demo", { p_host_id: userId });
  if (error) throw error;
  return userId;
}
