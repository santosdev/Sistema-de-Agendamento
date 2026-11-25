-- RN-05: usernames that would collide with app routes added in stage 8.
-- Static routes win over /[username], so a host with these names would be unreachable.
create or replace function public.is_reserved_username(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value = any (array[
    'dashboard', 'booking', 'api', 'login', 'logout', 'signup', 'auth', 'demo',
    'settings', 'embed', 'admin', 'app', 'static', 'public', '_next',
    'privacy', 'privacidade', 'terms', 'termos', 'help', 'ajuda'
  ]);
$$;
