-- =============================================================================
-- Core schema: profiles, event types, availability, bookings, rate limit.
-- All instants are timestamptz (UTC). Wall-clock times (availability) are
-- interpreted in the host profile time zone.
-- =============================================================================

create type public.location_type as enum ('google_meet', 'zoom', 'phone', 'in_person', 'custom_link');
create type public.phone_mode as enum ('host_calls', 'guest_calls');
create type public.event_color as enum ('violet', 'blue', 'teal', 'green', 'amber', 'rose', 'fuchsia', 'slate');
create type public.booking_status as enum ('confirmed', 'rescheduled', 'cancelled');
create type public.booking_actor as enum ('guest', 'host');

-- -----------------------------------------------------------------------------
-- profiles (one per auth user, created by trigger)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_path text,
  time_zone text not null default 'America/Sao_Paulo',
  welcome_message text,
  is_public boolean not null default true,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- RN-03/04: 3 to 30 chars, a-z 0-9 and "-", no leading or trailing "-", lowercase only.
  constraint profiles_username_format check (username ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  constraint profiles_username_not_reserved check (not public.is_reserved_username(username)),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 80),
  constraint profiles_welcome_message_length check (welcome_message is null or char_length(welcome_message) <= 500),
  constraint profiles_time_zone_valid check (public.is_valid_time_zone(time_zone)),
  -- RN-07: avatars live under avatars/<user id>/...
  constraint profiles_avatar_path_owner check (avatar_path is null or starts_with(avatar_path, id::text || '/'))
);

create unique index profiles_username_key on public.profiles (username);

-- -----------------------------------------------------------------------------
-- event_types
-- -----------------------------------------------------------------------------
create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  duration_minutes integer not null default 30,
  slot_interval_minutes integer not null default 30,
  location_type public.location_type not null default 'google_meet',
  location_value text,
  phone_mode public.phone_mode,
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes integer not null default 0,
  min_notice_minutes integer not null default 240,
  max_days_ahead integer not null default 60,
  daily_limit integer,
  questions jsonb not null default '[]'::jsonb,
  color public.event_color not null default 'violet',
  is_active boolean not null default true,
  position integer not null default 0,
  archived_at timestamptz,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_types_title_length check (char_length(btrim(title)) between 1 and 80),
  constraint event_types_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$'),
  constraint event_types_description_length check (description is null or char_length(description) <= 1000),
  constraint event_types_duration check (duration_minutes between 5 and 480),
  constraint event_types_slot_interval check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  constraint event_types_buffers check (
    buffer_before_minutes between 0 and 120 and buffer_after_minutes between 0 and 120
  ),
  constraint event_types_min_notice check (min_notice_minutes between 0 and 43200),
  constraint event_types_max_days_ahead check (max_days_ahead between 1 and 365),
  constraint event_types_daily_limit check (daily_limit is null or daily_limit between 1 and 50),
  constraint event_types_questions_valid check (public.is_valid_questions(questions)),
  -- RN-10 to RN-13. coalesce: a NULL result would make the CHECK pass silently.
  constraint event_types_location check (coalesce(
    (location_type in ('google_meet', 'zoom', 'custom_link')
      and location_value ~ '^https://[^\s]+$' and char_length(location_value) <= 500 and phone_mode is null)
    or (location_type = 'in_person'
      and char_length(btrim(location_value)) between 1 and 300 and phone_mode is null)
    or (location_type = 'phone' and phone_mode = 'host_calls' and location_value is null)
    or (location_type = 'phone' and phone_mode = 'guest_calls' and location_value ~ '^\+[1-9][0-9]{7,14}$'),
    false
  ))
);

-- RN-19: archived events free their slug.
create unique index event_types_host_slug_key on public.event_types (host_id, slug) where archived_at is null;
create index event_types_host_position_idx on public.event_types (host_id, position);

-- -----------------------------------------------------------------------------
-- availability_rules (weekly, RN-20 to RN-24)
-- weekday: 0 = Sunday ... 6 = Saturday. end_time may be 24:00.
-- -----------------------------------------------------------------------------
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null,
  start_time time not null,
  end_time time not null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),

  constraint availability_rules_weekday check (weekday between 0 and 6),
  constraint availability_rules_order check (start_time < end_time),
  -- RN-21: intervals of the same day cannot overlap.
  constraint availability_rules_no_overlap exclude using gist (
    host_id with =,
    weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') with &&
  )
);

-- -----------------------------------------------------------------------------
-- availability_overrides (per date, RN-25/26)
-- start_time and end_time both null = day off; otherwise a special interval that
-- replaces the weekly rules for that date. A day off conflicts with any interval.
-- -----------------------------------------------------------------------------
create table public.availability_overrides (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),

  constraint availability_overrides_shape check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and start_time < end_time)
  ),
  constraint availability_overrides_no_overlap exclude using gist (
    host_id with =,
    date with =,
    tsrange(
      date '2000-01-01' + coalesce(start_time, time '00:00'),
      date '2000-01-01' + coalesce(end_time, time '24:00'),
      '[)'
    ) with &&
  )
);

-- -----------------------------------------------------------------------------
-- bookings
-- -----------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  -- NO ACTION (checked at statement end) so deleting a profile cascades cleanly,
  -- while deleting an event type that still has bookings fails (RN-19: archive instead).
  event_type_id uuid not null references public.event_types (id),
  status public.booking_status not null default 'confirmed',
  start_at timestamptz not null,
  end_at timestamptz not null,

  -- RN-43: snapshot of the event at booking time.
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes integer not null default 0,
  event_title text not null,
  location_type public.location_type not null,
  location_value text,
  phone_mode public.phone_mode,

  -- Range blocked on the host calendar (start/end expanded by buffers), set by trigger.
  blocked_from timestamptz not null,
  blocked_until timestamptz not null,

  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  guest_time_zone text not null,
  -- RN-17: [{ question_id, label, type, value }], labels copied at booking time.
  answers jsonb not null default '[]'::jsonb,

  -- RN-45/46: only the SHA-256 of the manage token is stored.
  manage_token_hash bytea not null,

  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by public.booking_actor,

  -- RN-52: reschedule keeps the same row.
  previous_start_at timestamptz,
  rescheduled_at timestamptz,
  reschedule_count integer not null default 0,

  -- RN-56: .ics SEQUENCE, incremented on every change.
  ics_sequence integer not null default 0,

  anonymized_at timestamptz,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bookings_time_order check (end_at > start_at),
  constraint bookings_buffers check (
    buffer_before_minutes between 0 and 120 and buffer_after_minutes between 0 and 120
  ),
  constraint bookings_guest_name_length check (char_length(btrim(guest_name)) between 2 and 100),
  constraint bookings_guest_email_format check (
    char_length(guest_email) <= 254 and guest_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  constraint bookings_guest_phone_format check (guest_phone is null or guest_phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint bookings_guest_time_zone_valid check (public.is_valid_time_zone(guest_time_zone)),
  constraint bookings_answers_array check (jsonb_typeof(answers) = 'array'),
  constraint bookings_cancel_reason_length check (cancel_reason is null or char_length(cancel_reason) <= 500),
  constraint bookings_cancel_consistency check (
    (status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null)
  ),
  constraint bookings_manage_token_hash_length check (octet_length(manage_token_hash) = 32),

  -- RN-41: no two active bookings of the same host may overlap, buffers included.
  -- Cancelled bookings are ignored.
  constraint bookings_no_overlap exclude using gist (
    host_id with =,
    tstzrange(blocked_from, blocked_until, '[)') with &&
  ) where (status <> 'cancelled')
);

create unique index bookings_manage_token_hash_key on public.bookings (manage_token_hash);
create index bookings_host_start_idx on public.bookings (host_id, start_at);
create index bookings_event_type_start_idx on public.bookings (event_type_id, start_at);

-- timestamptz - interval is only STABLE, so the blocked range cannot be a generated
-- column. A trigger keeps it in sync instead.
create or replace function public.set_booking_blocked_range()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.blocked_from := new.start_at - pg_catalog.make_interval(mins => new.buffer_before_minutes);
  new.blocked_until := new.end_at + pg_catalog.make_interval(mins => new.buffer_after_minutes);
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- rate_limit_hits (RN-60). Buckets are hashes computed on the server.
-- -----------------------------------------------------------------------------
create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_bucket_created_idx on public.rate_limit_hits (bucket, created_at desc);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger event_types_set_updated_at before update on public.event_types
  for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

create trigger bookings_set_blocked_range before insert or update on public.bookings
  for each row execute function public.set_booking_blocked_range();

create trigger profiles_guard_seed before insert or update or delete on public.profiles
  for each row execute function public.guard_seed_rows();
create trigger event_types_guard_seed before insert or update or delete on public.event_types
  for each row execute function public.guard_seed_rows();
create trigger availability_rules_guard_seed before insert or update or delete on public.availability_rules
  for each row execute function public.guard_seed_rows();
create trigger availability_overrides_guard_seed before insert or update or delete on public.availability_overrides
  for each row execute function public.guard_seed_rows();
create trigger bookings_guard_seed before insert or update or delete on public.bookings
  for each row execute function public.guard_seed_rows();

-- -----------------------------------------------------------------------------
-- New user -> profile + default availability (RN-02, RN-09, RN-24)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_username text;
  v_display_name text;
  v_time_zone text;
  v_weekday smallint;
begin
  -- Username: email local part, slugified, plus a short random suffix. Editable later.
  v_base := lower(split_part(coalesce(new.email, ''), '@', 1));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := btrim(left(btrim(v_base, '-'), 20), '-');
  if char_length(v_base) < 3 then
    v_base := 'host';
  end if;

  loop
    v_username := v_base || '-' || substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 5);
    exit when not exists (select 1 from public.profiles p where p.username = v_username);
  end loop;

  v_display_name := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Anfitrião'
  )), 80);
  if v_display_name = '' then
    v_display_name := 'Anfitrião';
  end if;

  v_time_zone := new.raw_user_meta_data ->> 'time_zone';
  if not public.is_valid_time_zone(v_time_zone) then
    v_time_zone := 'America/Sao_Paulo';
  end if;

  insert into public.profiles (id, username, display_name, time_zone)
  values (new.id, v_username, v_display_name, v_time_zone);

  -- Monday to Friday, 09:00 to 18:00.
  for v_weekday in 1..5 loop
    insert into public.availability_rules (host_id, weekday, start_time, end_time)
    values (new.id, v_weekday, time '09:00', time '18:00');
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
