-- =============================================================================
-- Row Level Security (RN-61)
--
-- anon (public):  reads public profiles, active events of public hosts and the
--                 availability of public hosts. Never reads bookings.
-- authenticated:  same public reads + full access to its own rows. Bookings are
--                 read-only; changes go through security definer functions.
-- service_role:   bypasses RLS; used only by the server (booking creation,
--                 guest token flows, demo reset, maintenance).
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.event_types enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_overrides enable row level security;
alter table public.bookings enable row level security;
alter table public.rate_limit_hits enable row level security;

-- Helper: is this host publicly visible? (security definer avoids RLS recursion and
-- keeps the policies below short and fast).
create or replace function public.is_public_host(p_host_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = p_host_id and p.is_public);
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated
  using (is_public);

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert policy: profiles are created by the auth trigger.
-- No delete policy: deleting the auth user cascades.

-- -----------------------------------------------------------------------------
-- event_types
-- -----------------------------------------------------------------------------
create policy "event_types_select_public" on public.event_types
  for select to anon, authenticated
  using (is_active and archived_at is null and public.is_public_host(host_id));

create policy "event_types_select_own" on public.event_types
  for select to authenticated
  using (host_id = (select auth.uid()));

create policy "event_types_insert_own" on public.event_types
  for insert to authenticated
  with check (host_id = (select auth.uid()));

create policy "event_types_update_own" on public.event_types
  for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "event_types_delete_own" on public.event_types
  for delete to authenticated
  using (host_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- availability_rules
-- -----------------------------------------------------------------------------
create policy "availability_rules_select_public" on public.availability_rules
  for select to anon, authenticated
  using (public.is_public_host(host_id));

create policy "availability_rules_select_own" on public.availability_rules
  for select to authenticated
  using (host_id = (select auth.uid()));

create policy "availability_rules_insert_own" on public.availability_rules
  for insert to authenticated
  with check (host_id = (select auth.uid()));

create policy "availability_rules_update_own" on public.availability_rules
  for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "availability_rules_delete_own" on public.availability_rules
  for delete to authenticated
  using (host_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- availability_overrides
-- -----------------------------------------------------------------------------
create policy "availability_overrides_select_public" on public.availability_overrides
  for select to anon, authenticated
  using (public.is_public_host(host_id));

create policy "availability_overrides_select_own" on public.availability_overrides
  for select to authenticated
  using (host_id = (select auth.uid()));

create policy "availability_overrides_insert_own" on public.availability_overrides
  for insert to authenticated
  with check (host_id = (select auth.uid()));

create policy "availability_overrides_update_own" on public.availability_overrides
  for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy "availability_overrides_delete_own" on public.availability_overrides
  for delete to authenticated
  using (host_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- bookings: hosts read their own. No public access at all.
-- -----------------------------------------------------------------------------
create policy "bookings_select_own" on public.bookings
  for select to authenticated
  using (host_id = (select auth.uid()));

-- Defense in depth: even without policies, remove write privileges from API roles.
revoke insert, update, delete, truncate on public.bookings from anon, authenticated;
revoke all on public.bookings from anon;

-- -----------------------------------------------------------------------------
-- rate_limit_hits: server only.
-- -----------------------------------------------------------------------------
revoke all on public.rate_limit_hits from anon, authenticated;

-- anon never writes host data.
revoke insert, update, delete, truncate
  on public.event_types, public.availability_rules, public.availability_overrides
  from anon;

-- profiles: rows are created and deleted only by triggers/cascades.
revoke insert, delete, truncate on public.profiles from anon, authenticated;
revoke update on public.profiles from anon;
