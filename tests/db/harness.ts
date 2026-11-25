/**
 * In-memory Postgres (PGlite) that mimics the parts of Supabase the migrations use:
 * roles anon/authenticated/service_role, auth.users + auth.uid(), storage stubs and
 * Supabase's default grants. Then applies supabase/migrations in order.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = resolve(__dirname, "../../supabase/migrations");

const SUPABASE_STUBS = /* sql */ `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on all tables in schema storage to anon, authenticated, service_role;
  grant execute on all functions in schema storage to anon, authenticated, service_role;

  -- Current Supabase projects: API roles get NO automatic grants on new tables or
  -- sequences in public (they must be granted explicitly by migrations).
  -- Functions keep the worst case (EXECUTE for everyone) so the grants migration is tested.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export type Db = PGlite;
type Queryable = PGlite | Transaction;

export async function createTestDb(): Promise<Db> {
  const db = await PGlite.create({ extensions: { btree_gist, pgcrypto } });
  await db.exec(SUPABASE_STUBS);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    try {
      await db.exec(readFileSync(resolve(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }

  return db;
}

/** Creates an auth user; the trigger creates the profile and default availability. */
export async function createUser(db: Queryable, email: string, meta: Record<string, unknown> = {}) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(meta)],
  );
  return rows[0].id;
}

type Role = { kind: "anon" } | { kind: "authenticated"; userId: string } | { kind: "service_role" };

/**
 * Runs fn as an API role (like a PostgREST request) inside a transaction.
 * If fn throws, the transaction rolls back and the error propagates.
 */
export async function as<T>(db: Db, role: Role, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const sub = role.kind === "authenticated" ? role.userId : "";
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [sub]);
    await tx.exec(`set local role ${role.kind}`);
    return fn(tx);
  });
}

export const anon: Role = { kind: "anon" };
export const service: Role = { kind: "service_role" };
export const user = (userId: string): Role => ({ kind: "authenticated", userId });

/** Extracts the P0001 message (our error code contract) from a failed promise. */
export async function errorOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("Expected the query to fail, but it succeeded.");
}

/** Next occurrence (UTC) of a weekday/hour at least `minDaysAhead` days from now. */
export function nextUtc(weekday: number, hour: number, minute = 0, minDaysAhead = 2): Date {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export const iso = (d: Date) => d.toISOString();
export const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);
