-- =============================================================================
-- Demo seed (RN-66 to RN-73) and maintenance (RN-65)
-- =============================================================================

-- n-th business day (Mon to Fri) from p_base. Offset 0 = p_base if it is a
-- business day, otherwise the next one. Negative offsets go back in time.
create or replace function public._demo_business_day(p_base date, p_offset integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day date := p_base;
  v_step integer := case when p_offset < 0 then -1 else 1 end;
  v_remaining integer := abs(p_offset);
begin
  while extract(isodow from v_day) > 5 loop
    v_day := v_day + 1;
  end loop;

  while v_remaining > 0 loop
    v_day := v_day + v_step;
    if extract(isodow from v_day) <= 5 then
      v_remaining := v_remaining - 1;
    end if;
  end loop;

  return v_day;
end;
$$;

-- Rebuilds the demo host data with dates relative to today.
-- Removes everything the visitors created for this host (RN-69, RN-72).
-- The auth user must already exist (scripts/demo-reset.ts creates it).
create or replace function public.seed_demo(p_host_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'America/Sao_Paulo';
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_intro uuid;
  v_consult uuid;
  v_call uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = p_host_id) then
    raise exception 'host_not_found' using errcode = 'P0001';
  end if;

  -- Lets this transaction write is_seed rows (see guard_seed_rows).
  perform set_config('app.allow_seed_write', 'on', true);

  delete from public.bookings where host_id = p_host_id;
  delete from public.event_types where host_id = p_host_id;
  delete from public.availability_rules where host_id = p_host_id;
  delete from public.availability_overrides where host_id = p_host_id;

  update public.profiles
  set username = 'marina-demo',
      display_name = 'Marina Alves',
      time_zone = v_tz,
      welcome_message = 'Olá! Escolha o tipo de conversa e um horário que funcione para você. '
        || 'Os horários aparecem no seu fuso automaticamente.',
      avatar_path = null,
      is_public = true,
      is_seed = true
  where id = p_host_id;

  -- Monday to Friday, 09:00 to 12:00 and 13:30 to 18:00.
  insert into public.availability_rules (host_id, weekday, start_time, end_time, is_seed)
  select p_host_id, d, t.s, t.e, true
  from generate_series(1, 5) d
  cross join (values (time '09:00', time '12:00'), (time '13:30', time '18:00')) t(s, e);

  -- A special-hours day and a day off.
  insert into public.availability_overrides (host_id, date, start_time, end_time, is_seed) values
    (p_host_id, public._demo_business_day(v_today, 6), time '10:00', time '13:00', true),
    (p_host_id, public._demo_business_day(v_today, 8), null, null, true);

  insert into public.event_types (
    host_id, title, slug, description, duration_minutes, slot_interval_minutes,
    location_type, location_value, color, questions, position, is_seed
  ) values (
    p_host_id, 'Conversa inicial', 'conversa-inicial',
    'Uma conversa rápida para entender seu projeto e ver se faz sentido trabalharmos juntos.',
    30, 30, 'google_meet', 'https://meet.google.com/abc-defg-hij', 'violet',
    '[
      {"id": "company", "type": "short_text", "label": "Nome da empresa", "required": false},
      {"id": "goal", "type": "long_text", "label": "O que você quer resolver?", "required": true}
    ]'::jsonb,
    0, true
  ) returning id into v_intro;

  insert into public.event_types (
    host_id, title, slug, description, duration_minutes, slot_interval_minutes,
    location_type, location_value, buffer_before_minutes, buffer_after_minutes,
    daily_limit, color, questions, position, is_seed
  ) values (
    p_host_id, 'Consultoria técnica', 'consultoria-tecnica',
    'Uma hora para revisar arquitetura, código ou processo do seu time, com recomendações práticas.',
    60, 30, 'zoom', 'https://zoom.us/j/1234567890', 15, 15,
    3, 'blue',
    '[
      {"id": "team_size", "type": "single_choice", "label": "Tamanho da equipe", "required": true,
       "options": ["Só eu", "2 a 5 pessoas", "6 a 20 pessoas", "Mais de 20"]},
      {"id": "topics", "type": "multi_choice", "label": "Quais temas?", "required": false,
       "options": ["Arquitetura", "Performance", "Segurança", "Processo"]}
    ]'::jsonb,
    1, true
  ) returning id into v_consult;

  insert into public.event_types (
    host_id, title, slug, description, duration_minutes, slot_interval_minutes,
    location_type, phone_mode, min_notice_minutes, color, position, is_seed
  ) values (
    p_host_id, 'Ligação rápida', 'ligacao-rapida',
    'Quinze minutos por telefone para tirar uma dúvida pontual. Eu ligo para você.',
    15, 15, 'phone', 'host_calls', 120, 'teal', 2, true
  ) returning id into v_call;

  insert into public.event_types (
    host_id, title, slug, description, duration_minutes, slot_interval_minutes,
    location_type, location_value, color, is_active, position, is_seed
  ) values (
    p_host_id, 'Workshop presencial', 'workshop-presencial',
    'Meio período de imersão com o seu time, no seu escritório.',
    240, 60, 'in_person', 'Av. Paulista, 1000, São Paulo, SP', 'amber', false, 3, true
  );

  -- Bookings: past, upcoming, cancelled and rescheduled, relative to today.
  insert into public.bookings (
    host_id, event_type_id, status, start_at, end_at,
    buffer_before_minutes, buffer_after_minutes,
    event_title, location_type, location_value, phone_mode,
    guest_name, guest_email, guest_phone, guest_time_zone, answers,
    manage_token_hash,
    cancel_reason, cancelled_at, cancelled_by,
    previous_start_at, rescheduled_at, reschedule_count, ics_sequence,
    is_seed
  )
  select
    p_host_id, e.id, s.status::public.booking_status, s.start_at, s.start_at + make_interval(mins => e.duration_minutes),
    e.buffer_before_minutes, e.buffer_after_minutes,
    e.title, e.location_type, e.location_value, e.phone_mode,
    s.guest_name, s.guest_email, s.guest_phone, s.guest_tz, s.answers,
    extensions.digest(extensions.gen_random_bytes(32), 'sha256'),
    case when s.status = 'cancelled' then s.cancel_reason end,
    case when s.status = 'cancelled' then now() - interval '1 day' end,
    case when s.status = 'cancelled' then s.cancelled_by::public.booking_actor end,
    case when s.status = 'rescheduled' then s.start_at - interval '1 day' end,
    case when s.status = 'rescheduled' then now() - interval '2 days' end,
    case when s.status = 'rescheduled' then 1 else 0 end,
    case when s.status = 'confirmed' then 0 else 1 end,
    true
  from (
    select
      v.event_key, v.status, v.guest_name, v.guest_email, v.guest_phone, v.guest_tz, v.answers,
      v.cancel_reason, v.cancelled_by,
      (public._demo_business_day(v_today, v.day_offset) + v.local_time) at time zone v_tz as start_at
    from (values
      (-6, time '10:00', 'intro',   'confirmed',   'Lucas Pereira',     'lucas.pereira@example.com',     null,             'America/Sao_Paulo',
        '[{"question_id":"goal","label":"O que você quer resolver?","type":"long_text","value":"Migrar nosso sistema legado para a nuvem."}]'::jsonb, null, null),
      (-5, time '14:00', 'consult', 'confirmed',   'Beatriz Santos',    'beatriz.santos@example.com',    null,             'America/Sao_Paulo',
        '[{"question_id":"team_size","label":"Tamanho da equipe","type":"single_choice","value":"6 a 20 pessoas"}]'::jsonb, null, null),
      (-4, time '09:30', 'call',    'confirmed',   'Rafael Lima',       'rafael.lima@example.com',       '+5511987654321', 'America/Sao_Paulo', '[]'::jsonb, null, null),
      (-3, time '15:00', 'intro',   'cancelled',   'Camila Rocha',      'camila.rocha@example.com',      null,             'America/Sao_Paulo',
        '[{"question_id":"goal","label":"O que você quer resolver?","type":"long_text","value":"Melhorar o tempo de carregamento do site."}]'::jsonb,
        'Precisei reorganizar a agenda da semana.', 'guest'),
      (-2, time '11:00', 'consult', 'rescheduled', 'Diego Martins',     'diego.martins@example.com',     null,             'America/Sao_Paulo',
        '[{"question_id":"team_size","label":"Tamanho da equipe","type":"single_choice","value":"2 a 5 pessoas"}]'::jsonb, null, null),
      (-1, time '16:30', 'intro',   'confirmed',   'Juliana Ferreira',  'juliana.ferreira@example.com',  null,             'Europe/Lisbon',
        '[{"question_id":"goal","label":"O que você quer resolver?","type":"long_text","value":"Criar um app de agendamento para minha clínica."}]'::jsonb, null, null),
      ( 1, time '09:00', 'intro',   'confirmed',   'Pedro Henrique',    'pedro.henrique@example.com',    null,             'America/Sao_Paulo',
        '[{"question_id":"company","label":"Nome da empresa","type":"short_text","value":"Henrique Engenharia"},{"question_id":"goal","label":"O que você quer resolver?","type":"long_text","value":"Automatizar orçamentos."}]'::jsonb, null, null),
      ( 1, time '14:00', 'consult', 'confirmed',   'Fernanda Oliveira', 'fernanda.oliveira@example.com', '+5521912345678', 'America/Sao_Paulo',
        '[{"question_id":"team_size","label":"Tamanho da equipe","type":"single_choice","value":"Mais de 20"},{"question_id":"topics","label":"Quais temas?","type":"multi_choice","value":["Arquitetura","Segurança"]}]'::jsonb, null, null),
      ( 2, time '10:30', 'call',    'rescheduled', 'Thiago Souza',      'thiago.souza@example.com',      '+5531998765432', 'America/Sao_Paulo', '[]'::jsonb, null, null),
      ( 3, time '15:00', 'intro',   'confirmed',   'Larissa Mendes',    'larissa.mendes@example.com',    null,             'America/New_York',
        '[{"question_id":"goal","label":"O que você quer resolver?","type":"long_text","value":"Expandir nosso e-commerce para o Brasil."}]'::jsonb, null, null),
      ( 4, time '09:00', 'consult', 'cancelled',   'Gustavo Ribeiro',   'gustavo.ribeiro@example.com',   null,             'America/Sao_Paulo',
        '[{"question_id":"team_size","label":"Tamanho da equipe","type":"single_choice","value":"Só eu"}]'::jsonb,
        'Conflito com outra reunião.', 'host'),
      ( 5, time '11:00', 'intro',   'confirmed',   'Isabela Carvalho',  'isabela.carvalho@example.com',  null,             'America/Sao_Paulo',
        '[{"question_id":"goal","label":"O que você quer resolver?","type":"long_text","value":"Revisar a experiência do nosso app."}]'::jsonb, null, null),
      ( 7, time '16:00', 'consult', 'confirmed',   'Marcelo Araújo',    'marcelo.araujo@example.com',    null,             'America/Sao_Paulo',
        '[{"question_id":"team_size","label":"Tamanho da equipe","type":"single_choice","value":"2 a 5 pessoas"},{"question_id":"topics","label":"Quais temas?","type":"multi_choice","value":["Performance"]}]'::jsonb, null, null)
    ) as v(day_offset, local_time, event_key, status, guest_name, guest_email, guest_phone, guest_tz, answers, cancel_reason, cancelled_by)
  ) s
  join public.event_types e on e.id = case s.event_key
    when 'intro' then v_intro
    when 'consult' then v_consult
    when 'call' then v_call
  end;
end;
$$;

-- RN-65: anonymize guests of meetings that ended more than 12 months ago.
-- Also purges old rate limit hits. Returns the number of anonymized bookings.
create or replace function public.run_maintenance()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.bookings b
  set guest_name = 'Convidado removido',
      guest_email = 'removido+' || b.id::text || '@invalid.example',
      guest_phone = null,
      answers = '[]'::jsonb,
      anonymized_at = now()
  where b.end_at < now() - interval '12 months'
    and b.anonymized_at is null
    and not b.is_seed;
  get diagnostics v_count = row_count;

  delete from public.rate_limit_hits h where h.created_at < now() - interval '1 day';

  return v_count;
end;
$$;
