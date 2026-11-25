import { z } from "zod";

/**
 * Public env vars (inlined in the client bundle).
 * Each var is read explicitly so Next.js can inline it at build time.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type PublicEnv = z.infer<typeof schema>;

let cached: PublicEnv | undefined;

/** Validated on first use, so builds without env (CI lint) do not fail at import time. */
export function publicEnv(): PublicEnv {
  cached ??= schema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  return cached;
}
