-- =============================================================================
-- Table privileges
--
-- New Supabase projects do not grant API roles anything on new tables in public.
-- Grants decide WHICH operations a role may attempt; RLS (rls migration) decides
-- WHICH ROWS. Both are required. Grants here are the minimum each role needs.
-- =============================================================================

-- profiles: public reads; hosts update only editable columns (never id or is_seed).
grant select on public.profiles to anon, authenticated;
grant update (username, display_name, avatar_path, time_zone, welcome_message, is_public)
  on public.profiles to authenticated;

-- Host data: public reads (filtered by RLS); hosts manage their own rows.
grant select on public.event_types, public.availability_rules, public.availability_overrides to anon;
grant select, insert, update, delete
  on public.event_types, public.availability_rules, public.availability_overrides
  to authenticated;

-- bookings: hosts read their own (RLS). Writes only through security definer functions.
grant select on public.bookings to authenticated;

-- service_role: trusted server (demo reset, emails, maintenance). Bypasses RLS.
grant select, insert, update, delete
  on public.profiles, public.event_types, public.availability_rules,
     public.availability_overrides, public.bookings, public.rate_limit_hits
  to service_role;
grant usage, select on all sequences in schema public to service_role;
