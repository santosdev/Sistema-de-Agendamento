-- =============================================================================
-- Extensions and helper functions
-- =============================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Validation helpers (used in CHECK constraints, so they must stay immutable and
-- executable by API roles).
-- -----------------------------------------------------------------------------

-- IANA time zone name such as "America/Sao_Paulo" or "UTC".
-- Rejects abbreviations (BRT) and POSIX strings (UTC+3).
-- Declared immutable to be usable in CHECK; the tz database only changes on server upgrades.
create or replace function public.is_valid_time_zone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if tz is null or tz !~ '^(UTC|[A-Za-z]+(/[A-Za-z0-9_+-]+){1,2})$' then
    return false;
  end if;
  perform pg_catalog.now() at time zone tz;
  return true;
exception
  when others then
    return false;
end;
$$;

-- RN-05: words that would collide with app routes.
create or replace function public.is_reserved_username(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value = any (array[
    'dashboard', 'booking', 'api', 'login', 'logout', 'signup', 'auth', 'demo',
    'settings', 'embed', 'admin', 'app', 'static', 'public', '_next'
  ]);
$$;

-- RN-14 to RN-16: custom questions of an event type.
-- [{ "id": "goal", "type": "long_text", "label": "...", "required": true, "options": [...]? }]
create or replace function public.is_valid_questions(questions jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  q jsonb;
  q_id text;
  q_type text;
  seen_ids text[] := '{}';
begin
  if questions is null or jsonb_typeof(questions) <> 'array' or jsonb_array_length(questions) > 10 then
    return false;
  end if;

  for q in select value from jsonb_array_elements(questions) loop
    if jsonb_typeof(q) <> 'object' then
      return false;
    end if;

    q_id := q ->> 'id';
    q_type := q ->> 'type';

    if q_id is null or q_id !~ '^[a-z0-9_-]{1,40}$' or q_id = any (seen_ids) then
      return false;
    end if;
    seen_ids := seen_ids || q_id;

    if q_type is null or q_type not in ('short_text', 'long_text', 'single_choice', 'multi_choice') then
      return false;
    end if;

    if jsonb_typeof(q -> 'label') is distinct from 'string'
       or char_length(btrim(q ->> 'label')) not between 1 and 200 then
      return false;
    end if;

    if jsonb_typeof(q -> 'required') is distinct from 'boolean' then
      return false;
    end if;

    if q_type in ('single_choice', 'multi_choice') then
      if jsonb_typeof(q -> 'options') is distinct from 'array'
         or jsonb_array_length(q -> 'options') not between 2 and 10
         or exists (
           select 1
           from jsonb_array_elements(q -> 'options') o
           where jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 100
         )
         or (select count(distinct o #>> '{}') from jsonb_array_elements(q -> 'options') o)
            <> jsonb_array_length(q -> 'options') then
        return false;
      end if;
    elsif q ? 'options' then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Trigger helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

-- RN-68: rows with is_seed = true (demo base data) cannot be inserted, changed or
-- deleted, except by the demo reset, which sets app.allow_seed_write = 'on' locally.
-- The API never exposes set_config, so clients cannot flip this switch.
create or replace function public.guard_seed_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(pg_catalog.current_setting('app.allow_seed_write', true), '') = 'on' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.is_seed then
      raise exception 'demo_seed_protected' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if old.is_seed or (tg_op = 'UPDATE' and new.is_seed) then
    raise exception 'demo_seed_protected' using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;
