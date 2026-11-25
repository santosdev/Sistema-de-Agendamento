-- =============================================================================
-- Function privileges
--
-- Postgres grants EXECUTE to PUBLIC on new functions and Supabase also grants it
-- to anon and authenticated. Everything in public is locked down first, then
-- opened one by one. service_role keeps its default grants (trusted server).
-- =============================================================================

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;

-- Future functions created by postgres in public start locked as well.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- Used inside CHECK constraints and RLS policies: API roles must be able to run them.
grant execute on function public.is_valid_time_zone(text) to anon, authenticated;
grant execute on function public.is_reserved_username(text) to anon, authenticated;
grant execute on function public.is_valid_questions(jsonb) to anon, authenticated;
grant execute on function public.is_public_host(uuid) to anon, authenticated;

-- Public: busy ranges of public hosts (times only, no guest data).
grant execute on function public.get_busy_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;

-- Signed-in hosts: act on their own bookings.
grant execute on function public.host_cancel_booking(uuid, text) to authenticated;
grant execute on function public.host_reschedule_booking(uuid, timestamptz) to authenticated;

-- Server only (called with the secret key after Zod validation and rate limit).
grant execute on function public.create_booking(uuid, timestamptz, text, text, text, text, jsonb) to service_role;
grant execute on function public.get_booking_by_token(text) to service_role;
grant execute on function public.cancel_booking_by_token(text, text) to service_role;
grant execute on function public.reschedule_booking_by_token(text, timestamptz) to service_role;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.seed_demo(uuid) to service_role;
grant execute on function public.run_maintenance() to service_role;
