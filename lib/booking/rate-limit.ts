import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** RN-60: 5 actions every 10 minutes per IP and per e-mail. */
export const RATE_LIMIT = { max: 5, windowSeconds: 600 } as const;

/** Client IP as seen by Vercel (first entry of x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Salted hash: raw IPs and e-mails are never stored. */
export function rateLimitBucket(scope: string, value: string): string {
  const hash = createHash("sha256").update(`${serverEnv().RATE_LIMIT_SALT}:${scope}:${value}`).digest("hex");
  return `${scope}:${hash.slice(0, 40)}`;
}

/** Consumes one hit in every bucket. Returns false as soon as one is over the limit. */
export async function consumeRateLimit(buckets: string[]): Promise<boolean> {
  const db = createAdminClient();
  for (const bucket of buckets) {
    const { data, error } = await db.rpc("consume_rate_limit", {
      p_bucket: bucket,
      p_max: RATE_LIMIT.max,
      p_window_seconds: RATE_LIMIT.windowSeconds,
    });
    if (error) throw error;
    if (!data) return false;
  }
  return true;
}
