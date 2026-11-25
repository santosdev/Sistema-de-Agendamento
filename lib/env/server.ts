import "server-only";
import { z } from "zod";

/** Server-only secrets. Never import this from a Client Component. */
const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  // Optional until emails are configured: without it, emails are skipped and logged.
  RESEND_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  EMAIL_FROM: z.string().min(3),
  RATE_LIMIT_SALT: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  DEMO_USER_EMAIL: z.email(),
  DEMO_USER_PASSWORD: z.string().min(12),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= schema.parse(process.env);
  return cached;
}
