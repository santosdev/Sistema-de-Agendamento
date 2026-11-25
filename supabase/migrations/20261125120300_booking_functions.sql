-- =============================================================================
-- Booking functions
--
-- Error contract: functions raise SQLSTATE P0001 with one of these messages,
-- which the app maps to user-facing text:
--   event_not_found, booking_not_found, not_authenticated, invalid_guest,
--   invalid_answers, invalid_input, slot_in_past, outside_notice,
--   outside_booking_window, outside_availability, daily_limit_reached,
--   slot_taken, booking_already_cancelled, modification_deadline_passed,
--   demo_seed_protected (from the seed guard trigger)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal helpers (not callable through the API, see grants migration)
-- -----------------------------------------------------------------------------

-- Serializes writes per host so the daily limit cannot be exceeded by races.
-- (Overlaps are already impossible thanks to the exclusion constraint.)
create or replace function public._lock_host(p_host_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_host_id::text, 0));
$$;

create or replace function public._new_manage_token(out token text, out token_hash bytea)
language plpgsql
volatile
set search_path = ''
as $$
begin
  -- 32 random bytes, base64url without padding: 43 chars (RN-45).
  token := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  token_hash := extensions.digest(token, 'sha256');
end;
$$;

create or replace function public._hash_manage_token(p_token text)
returns bytea
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;
  return extensions.digest(p_token, 'sha256');
end;
$$;

-- Does [p_start, p_end) fit inside the host availability for that local day,
-- aligned to the event slot interval? (RN-25, RN-27, RN-28, RN-34)
-- Works on wall-clock time in the host zone, so DST days behave like the slot generator.
create or replace function public._fits_availability(
  p_host_id uuid,
  p_time_zone text,
  p_start timestamptz,
  p_end timestamptz,
  p_step_minutes integer
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local_start timestamp := p_start at time zone p_time_zone;
  v_local_end timestamp := p_end at time zone p_time_zone;
  v_day date := (p_start at time zone p_time_zone)::date;
begin
  if exists (select 1 from public.availability_overrides o where o.host_id = p_host_id and o.date = v_day) then
    return exists (
      select 1
      from public.availability_overrides o
      where o.host_id = p_host_id
        and o.date = v_day
        and o.start_time is not null
        and v_day + o.start_time <= v_local_start
        and v_local_end <= v_day + o.end_time
        and (extract(epoch from (v_local_start - (v_day + o.start_time)))::bigint / 60) % p_step_minutes = 0
    );
  end if;

  return exists (
    select 1
    from public.availability_rules r
    where r.host_id = p_host_id
      and r.weekday = extract(dow from v_day)::smallint
      and v_day + r.start_time <= v_local_start
      and v_local_end <= v_day + r.end_time
      and (extract(epoch from (v_local_start - (v_day + r.start_time)))::bigint / 60) % p_step_minutes = 0
  );
end;
$$;

-- Validates a slot for an event (RN-27 to RN-33). Overlaps are left to the
-- exclusion constraint. p_ignore_booking_id excludes the booking being rescheduled.
create or replace function public._assert_bookable(
  p_event public.event_types,
  p_time_zone text,
  p_start timestamptz,
  p_duration_minutes integer,
  p_ignore_booking_id uuid,
  p_enforce_notice boolean
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_end timestamptz := p_start + make_interval(mins => p_duration_minutes);
  v_local_day date := (p_start at time zone p_time_zone)::date;
  v_count integer;
begin
  if p_start is null or date_trunc('minute', p_start) <> p_start then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  if p_start <= now() then
    raise exception 'slot_in_past' using errcode = 'P0001';
  end if;

  if p_enforce_notice and p_start < now() + make_interval(mins => p_event.min_notice_minutes) then
    raise exception 'outside_notice' using errcode = 'P0001';
  end if;

  if p_start > now() + make_interval(days => p_event.max_days_ahead) then
    raise exception 'outside_booking_window' using errcode = 'P0001';
  end if;

  if not public._fits_availability(p_event.host_id, p_time_zone, p_start, v_end, p_event.slot_interval_minutes) then
    raise exception 'outside_availability' using errcode = 'P0001';
  end if;

  if p_event.daily_limit is not null then
    select count(*) into v_count
    from public.bookings b
    where b.event_type_id = p_event.id
      and b.status <> 'cancelled'
      and b.id is distinct from p_ignore_booking_id
      and (b.start_at at time zone p_time_zone)::date = v_local_day;

    if v_count >= p_event.daily_limit then
      raise exception 'daily_limit_reached' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

-- RN-14/15/17: validates guest answers against the event questions and returns
-- the snapshot stored on the booking.
-- p_answers: { "<question id>": "text" | ["option", ...] }
create or replace function public._build_answers(p_questions jsonb, p_answers jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  q jsonb;
  v jsonb;
  v_type text;
  v_result jsonb := '[]'::jsonb;
  v_is_empty boolean;
begin
  p_answers := coalesce(p_answers, '{}'::jsonb);

  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'invalid_answers' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_answers) k
    where not exists (select 1 from jsonb_array_elements(p_questions) e where e ->> 'id' = k)
  ) then
    raise exception 'invalid_answers' using errcode = 'P0001';
  end if;

  for q in select value from jsonb_array_elements(p_questions) loop
    v := p_answers -> (q ->> 'id');
    v_type := q ->> 'type';

    v_is_empty := v is null
      or jsonb_typeof(v) = 'null'
      or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '')
      or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0);

    if v_is_empty then
      if (q ->> 'required')::boolean then
        raise exception 'invalid_answers' using errcode = 'P0001';
      end if;
      continue;
    end if;

    if v_type = 'short_text' then
      if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 200 then
        raise exception 'invalid_answers' using errcode = 'P0001';
      end if;
      v := to_jsonb(btrim(v #>> '{}'));
    elsif v_type = 'long_text' then
      if jsonb_typeof(v) <> 'string' or char_length(v #>> '{}') > 2000 then
        raise exception 'invalid_answers' using errcode = 'P0001';
      end if;
      v := to_jsonb(btrim(v #>> '{}'));
    elsif v_type = 'single_choice' then
      if jsonb_typeof(v) <> 'string' or not ((q -> 'options') ? (v #>> '{}')) then
        raise exception 'invalid_answers' using errcode = 'P0001';
      end if;
    elsif v_type = 'multi_choice' then
      if jsonb_typeof(v) <> 'array' or exists (
        select 1 from jsonb_array_elements(v) x
        where jsonb_typeof(x) <> 'string' or not ((q -> 'options') ? (x #>> '{}'))
      ) then
        raise exception 'invalid_answers' using errcode = 'P0001';
      end if;
    end if;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'question_id', q ->> 'id',
      'label', q ->> 'label',
      'type', v_type,
      'value', v
    ));
  end loop;

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- Public read: busy ranges of a public host (no guest data). Used by the slot
-- generator. Capped at 100 days per call.
-- -----------------------------------------------------------------------------
create or replace function public.get_busy_ranges(p_host_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  event_type_id uuid,
  start_at timestamptz,
  end_at timestamptz,
  blocked_from timestamptz,
  blocked_until timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '100 days' then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  if not public.is_public_host(p_host_id) then
    return;
  end if;

  return query
    select b.event_type_id, b.start_at, b.end_at, b.blocked_from, b.blocked_until
    from public.bookings b
    where b.host_id = p_host_id
      and b.status <> 'cancelled'
      and b.blocked_until > p_from
      and b.blocked_from < p_to
    order by b.start_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_booking (server only, RN-39 to RN-43)
-- Returns the plain manage token once; only its hash is stored.
-- -----------------------------------------------------------------------------
create or replace function public.create_booking(
  p_event_type_id uuid,
  p_start_at timestamptz,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_guest_time_zone text,
  p_answers jsonb
)
returns table (booking_id uuid, manage_token text, start_at timestamptz, end_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event public.event_types;
  v_host_tz text;
  v_name text := btrim(p_guest_name);
  v_email text := lower(btrim(p_guest_email));
  v_phone text := nullif(btrim(p_guest_phone), '');
  v_answers jsonb;
  v_token text;
  v_token_hash bytea;
  v_end timestamptz;
  v_id uuid;
begin
  select e.* into v_event
  from public.event_types e
  join public.profiles p on p.id = e.host_id
  where e.id = p_event_type_id
    and e.is_active
    and e.archived_at is null
    and p.is_public;

  if not found then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  select p.time_zone into v_host_tz from public.profiles p where p.id = v_event.host_id;

  if v_name is null or char_length(v_name) not between 2 and 100
     or v_email is null or char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or (v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$')
     or (v_event.location_type = 'phone' and v_event.phone_mode = 'host_calls' and v_phone is null)
     or not public.is_valid_time_zone(p_guest_time_zone) then
    raise exception 'invalid_guest' using errcode = 'P0001';
  end if;

  v_answers := public._build_answers(v_event.questions, p_answers);

  perform public._lock_host(v_event.host_id);
  perform public._assert_bookable(v_event, v_host_tz, p_start_at, v_event.duration_minutes, null, true);

  v_end := p_start_at + make_interval(mins => v_event.duration_minutes);
  select t.token, t.token_hash into v_token, v_token_hash from public._new_manage_token() t;

  begin
    insert into public.bookings (
      host_id, event_type_id, start_at, end_at,
      buffer_before_minutes, buffer_after_minutes,
      event_title, location_type, location_value, phone_mode,
      guest_name, guest_email, guest_phone, guest_time_zone, answers,
      manage_token_hash
    ) values (
      v_event.host_id, v_event.id, p_start_at, v_end,
      v_event.buffer_before_minutes, v_event.buffer_after_minutes,
      v_event.title, v_event.location_type, v_event.location_value, v_event.phone_mode,
      v_name, v_email, v_phone, p_guest_time_zone, v_answers,
      v_token_hash
    )
    returning id into v_id;
  exception
    when exclusion_violation then
      raise exception 'slot_taken' using errcode = 'P0001';
  end;

  return query select v_id, v_token, p_start_at, v_end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Guest token flows (server only, RN-47 to RN-55)
-- -----------------------------------------------------------------------------
create or replace function public.get_booking_by_token(p_token text)
returns table (
  booking_id uuid,
  status public.booking_status,
  start_at timestamptz,
  end_at timestamptz,
  previous_start_at timestamptz,
  guest_name text,
  guest_email text,
  guest_time_zone text,
  event_type_id uuid,
  event_slug text,
  event_title text,
  event_color public.event_color,
  location_type public.location_type,
  location_value text,
  phone_mode public.phone_mode,
  host_id uuid,
  host_username text,
  host_display_name text,
  host_avatar_path text,
  host_time_zone text,
  cancel_reason text,
  cancelled_by public.booking_actor,
  ics_sequence integer,
  modify_deadline timestamptz,
  can_modify boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
    select
      b.id, b.status, b.start_at, b.end_at, b.previous_start_at,
      b.guest_name, b.guest_email, b.guest_time_zone,
      e.id, e.slug, b.event_title, e.color,
      b.location_type,
      case when b.status = 'cancelled' then null else b.location_value end,
      b.phone_mode,
      p.id, p.username, p.display_name, p.avatar_path, p.time_zone,
      b.cancel_reason, b.cancelled_by, b.ics_sequence,
      b.start_at - make_interval(mins => e.min_notice_minutes),
      b.status <> 'cancelled' and now() < b.start_at - make_interval(mins => e.min_notice_minutes)
    from public.bookings b
    join public.event_types e on e.id = b.event_type_id
    join public.profiles p on p.id = b.host_id
    where b.manage_token_hash = public._hash_manage_token(p_token);
end;
$$;

create or replace function public.cancel_booking_by_token(p_token text, p_reason text default null)
returns table (booking_id uuid, ics_sequence integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_booking public.bookings;
  v_notice integer;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.manage_token_hash = public._hash_manage_token(p_token)
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'booking_already_cancelled' using errcode = 'P0001';
  end if;

  select e.min_notice_minutes into v_notice from public.event_types e where e.id = v_booking.event_type_id;

  if now() >= v_booking.start_at - make_interval(mins => v_notice) then
    raise exception 'modification_deadline_passed' using errcode = 'P0001';
  end if;

  update public.bookings b
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = 'guest',
      cancel_reason = v_reason,
      ics_sequence = b.ics_sequence + 1
  where b.id = v_booking.id;

  return query select v_booking.id, v_booking.ics_sequence + 1;
end;
$$;

create or replace function public.reschedule_booking_by_token(p_token text, p_new_start_at timestamptz)
returns table (
  booking_id uuid,
  previous_start_at timestamptz,
  start_at timestamptz,
  end_at timestamptz,
  ics_sequence integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_host_id uuid;
  v_booking public.bookings;
  v_event public.event_types;
  v_host_tz text;
  v_duration integer;
  v_new_end timestamptz;
begin
  select b.host_id into v_host_id
  from public.bookings b
  where b.manage_token_hash = public._hash_manage_token(p_token);

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;

  perform public._lock_host(v_host_id);

  select b.* into v_booking
  from public.bookings b
  where b.manage_token_hash = public._hash_manage_token(p_token)
  for update;

  if v_booking.status = 'cancelled' then
    raise exception 'booking_already_cancelled' using errcode = 'P0001';
  end if;

  select e.* into v_event
  from public.event_types e
  where e.id = v_booking.event_type_id and e.is_active and e.archived_at is null;

  if not found then
    raise exception 'event_not_found' using errcode = 'P0001';
  end if;

  if now() >= v_booking.start_at - make_interval(mins => v_event.min_notice_minutes) then
    raise exception 'modification_deadline_passed' using errcode = 'P0001';
  end if;

  if p_new_start_at = v_booking.start_at then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  select p.time_zone into v_host_tz from public.profiles p where p.id = v_booking.host_id;

  -- RN-43: keep the original duration.
  v_duration := (extract(epoch from (v_booking.end_at - v_booking.start_at)) / 60)::integer;
  perform public._assert_bookable(v_event, v_host_tz, p_new_start_at, v_duration, v_booking.id, true);
  v_new_end := p_new_start_at + make_interval(mins => v_duration);

  begin
    update public.bookings b
    set previous_start_at = v_booking.start_at,
        start_at = p_new_start_at,
        end_at = v_new_end,
        status = 'rescheduled',
        rescheduled_at = now(),
        reschedule_count = b.reschedule_count + 1,
        ics_sequence = b.ics_sequence + 1
    where b.id = v_booking.id;
  exception
    when exclusion_violation then
      raise exception 'slot_taken' using errcode = 'P0001';
  end;

  return query select v_booking.id, v_booking.start_at, p_new_start_at, v_new_end, v_booking.ics_sequence + 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- Host actions (authenticated host, RN-49, RN-54)
-- -----------------------------------------------------------------------------
create or replace function public.host_cancel_booking(p_booking_id uuid, p_reason text default null)
returns table (booking_id uuid, ics_sequence integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id and b.host_id = v_uid
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'booking_already_cancelled' using errcode = 'P0001';
  end if;

  if v_booking.end_at <= now() then
    raise exception 'modification_deadline_passed' using errcode = 'P0001';
  end if;

  update public.bookings b
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = 'host',
      cancel_reason = v_reason,
      ics_sequence = b.ics_sequence + 1
  where b.id = v_booking.id;

  return query select v_booking.id, v_booking.ics_sequence + 1;
end;
$$;

create or replace function public.host_reschedule_booking(p_booking_id uuid, p_new_start_at timestamptz)
returns table (
  booking_id uuid,
  previous_start_at timestamptz,
  start_at timestamptz,
  end_at timestamptz,
  ics_sequence integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings;
  v_event public.event_types;
  v_host_tz text;
  v_duration integer;
  v_new_end timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform public._lock_host(v_uid);

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id and b.host_id = v_uid
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0001';
  end if;

  if v_booking.status = 'cancelled' then
    raise exception 'booking_already_cancelled' using errcode = 'P0001';
  end if;

  if v_booking.start_at <= now() then
    raise exception 'modification_deadline_passed' using errcode = 'P0001';
  end if;

  if p_new_start_at = v_booking.start_at then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  select e.* into v_event from public.event_types e where e.id = v_booking.event_type_id;
  select p.time_zone into v_host_tz from public.profiles p where p.id = v_uid;

  v_duration := (extract(epoch from (v_booking.end_at - v_booking.start_at)) / 60)::integer;
  -- The host may ignore the minimum notice, but not availability or conflicts.
  perform public._assert_bookable(v_event, v_host_tz, p_new_start_at, v_duration, v_booking.id, false);
  v_new_end := p_new_start_at + make_interval(mins => v_duration);

  begin
    update public.bookings b
    set previous_start_at = v_booking.start_at,
        start_at = p_new_start_at,
        end_at = v_new_end,
        status = 'rescheduled',
        rescheduled_at = now(),
        reschedule_count = b.reschedule_count + 1,
        ics_sequence = b.ics_sequence + 1
    where b.id = v_booking.id;
  exception
    when exclusion_violation then
      raise exception 'slot_taken' using errcode = 'P0001';
  end;

  return query select v_booking.id, v_booking.start_at, p_new_start_at, v_new_end, v_booking.ics_sequence + 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rate limit (server only, RN-60). Returns true when the hit is allowed.
-- -----------------------------------------------------------------------------
create or replace function public.consume_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count integer;
begin
  if p_bucket is null or char_length(p_bucket) not between 1 and 200 or p_max < 1 or p_window_seconds < 1 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rate:' || p_bucket, 0));

  delete from public.rate_limit_hits h where h.bucket = p_bucket and h.created_at < v_since;

  select count(*) into v_count from public.rate_limit_hits h where h.bucket = p_bucket;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket) values (p_bucket);
  return true;
end;
$$;
