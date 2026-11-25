import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/server";

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Compared in constant time. */
export function isCronRequest(request: Request): boolean {
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${serverEnv().CRON_SECRET}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export const cronJson = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
