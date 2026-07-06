-- SyncMenu — initial schema, RLS, pairing + player RPCs, realtime triggers.
-- Run this in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  logo_url text,
  brand_color text not null default '#FF6B2C',
  currency text not null default 'USD',
  trial_ends_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create unique index restaurants_owner_idx on public.restaurants (owner_id);

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  template_id text not null default 'classic',
  template_config jsonb not null default '{}'::jsonb,
  orientation text not null default 'landscape'
    check (orientation in ('landscape', 'portrait')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_sections (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.menu_sections(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0,
  image_url text,
  available boolean not null default true,
  sort_order int not null default 0
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.playlist_slides (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  menu_id uuid not null references public.menus(id) on delete cascade,
  duration_seconds int not null default 15 check (duration_seconds between 3 and 600),
  transition text not null default 'fade' check (transition in ('fade', 'slide-up')),
  sort_order int not null default 0
);

create table public.screens (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  orientation text not null default 'landscape'
    check (orientation in ('landscape', 'portrait')),
  device_token uuid not null default gen_random_uuid(),
  assigned_menu_id uuid references public.menus(id) on delete set null,
  assigned_playlist_id uuid references public.playlists(id) on delete set null,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create unique index screens_device_token_idx on public.screens (device_token);

create table public.pairing_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  secret uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'claimed')),
  screen_id uuid references public.screens(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

-- keep menus.updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger menus_touch before update on public.menus
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- Row-Level Security: everything scoped to the owner's restaurant.
-- The kiosk player never reads tables directly — only via the
-- security-definer RPCs below, authenticated by its device token.
-- ------------------------------------------------------------------

alter table public.restaurants enable row level security;
alter table public.menus enable row level security;
alter table public.menu_sections enable row level security;
alter table public.menu_items enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_slides enable row level security;
alter table public.screens enable row level security;
alter table public.pairing_sessions enable row level security; -- no policies: RPC-only

create policy restaurants_owner on public.restaurants
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy menus_owner on public.menus
  for all using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ) with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy menu_sections_owner on public.menu_sections
  for all using (
    menu_id in (
      select m.id from public.menus m
      join public.restaurants r on r.id = m.restaurant_id
      where r.owner_id = auth.uid()
    )
  ) with check (
    menu_id in (
      select m.id from public.menus m
      join public.restaurants r on r.id = m.restaurant_id
      where r.owner_id = auth.uid()
    )
  );

create policy menu_items_owner on public.menu_items
  for all using (
    section_id in (
      select s.id from public.menu_sections s
      join public.menus m on m.id = s.menu_id
      join public.restaurants r on r.id = m.restaurant_id
      where r.owner_id = auth.uid()
    )
  ) with check (
    section_id in (
      select s.id from public.menu_sections s
      join public.menus m on m.id = s.menu_id
      join public.restaurants r on r.id = m.restaurant_id
      where r.owner_id = auth.uid()
    )
  );

create policy playlists_owner on public.playlists
  for all using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ) with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy playlist_slides_owner on public.playlist_slides
  for all using (
    playlist_id in (
      select p.id from public.playlists p
      join public.restaurants r on r.id = p.restaurant_id
      where r.owner_id = auth.uid()
    )
  ) with check (
    playlist_id in (
      select p.id from public.playlists p
      join public.restaurants r on r.id = p.restaurant_id
      where r.owner_id = auth.uid()
    )
  );

create policy screens_owner on public.screens
  for all using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ) with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

-- ------------------------------------------------------------------
-- Realtime: broadcast a "content_updated" event to every screen of a
-- restaurant whenever its content changes. Players subscribe to the
-- public topic "screen:<screen_id>" (unguessable UUID).
-- ------------------------------------------------------------------

create or replace function public.broadcast_to_restaurant_screens(rid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  for sid in select id from public.screens where restaurant_id = rid loop
    begin
      perform realtime.send(
        jsonb_build_object('at', now()),
        'content_updated',
        'screen:' || sid::text,
        false
      );
    exception when others then
      null; -- realtime unavailable must never block writes
    end;
  end loop;
end $$;

create or replace function public.trg_broadcast_menus()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.broadcast_to_restaurant_screens(coalesce(new.restaurant_id, old.restaurant_id));
  return coalesce(new, old);
end $$;

create or replace function public.trg_broadcast_sections()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select restaurant_id into rid from public.menus where id = coalesce(new.menu_id, old.menu_id);
  if rid is not null then perform public.broadcast_to_restaurant_screens(rid); end if;
  return coalesce(new, old);
end $$;

create or replace function public.trg_broadcast_items()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select m.restaurant_id into rid
  from public.menu_sections s join public.menus m on m.id = s.menu_id
  where s.id = coalesce(new.section_id, old.section_id);
  if rid is not null then perform public.broadcast_to_restaurant_screens(rid); end if;
  return coalesce(new, old);
end $$;

create or replace function public.trg_broadcast_playlists()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.broadcast_to_restaurant_screens(coalesce(new.restaurant_id, old.restaurant_id));
  return coalesce(new, old);
end $$;

create or replace function public.trg_broadcast_slides()
returns trigger language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select restaurant_id into rid from public.playlists where id = coalesce(new.playlist_id, old.playlist_id);
  if rid is not null then perform public.broadcast_to_restaurant_screens(rid); end if;
  return coalesce(new, old);
end $$;

create or replace function public.trg_broadcast_screens()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- tell the (possibly removed) screen itself, then the rest of the fleet
  begin
    perform realtime.send(
      jsonb_build_object('at', now()),
      'content_updated',
      'screen:' || coalesce(new.id, old.id)::text,
      false
    );
  exception when others then null;
  end;
  return coalesce(new, old);
end $$;

create trigger menus_broadcast after insert or update or delete on public.menus
  for each row execute function public.trg_broadcast_menus();
create trigger sections_broadcast after insert or update or delete on public.menu_sections
  for each row execute function public.trg_broadcast_sections();
create trigger items_broadcast after insert or update or delete on public.menu_items
  for each row execute function public.trg_broadcast_items();
create trigger playlists_broadcast after insert or update or delete on public.playlists
  for each row execute function public.trg_broadcast_playlists();
create trigger slides_broadcast after insert or update or delete on public.playlist_slides
  for each row execute function public.trg_broadcast_slides();
-- Only assignment-relevant columns; last_seen_at heartbeats must NOT rebroadcast.
create trigger screens_broadcast
  after update of name, orientation, assigned_menu_id, assigned_playlist_id on public.screens
  for each row execute function public.trg_broadcast_screens();
create trigger screens_broadcast_delete after delete on public.screens
  for each row execute function public.trg_broadcast_screens();

-- ------------------------------------------------------------------
-- QR pairing RPCs
-- ------------------------------------------------------------------

-- Called by the (anonymous) TV player to start pairing.
create or replace function public.create_pairing_session()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.pairing_sessions;
  v_code text;
begin
  delete from public.pairing_sessions where expires_at < now();
  loop
    -- 6 chars, unambiguous alphabet
    v_code := (
      select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (random() * 30)::int + 1, 1), '')
      from generate_series(1, 6)
    );
    exit when not exists (select 1 from public.pairing_sessions where code = v_code);
  end loop;
  insert into public.pairing_sessions (code) values (v_code) returning * into s;
  return jsonb_build_object(
    'session_id', s.id,
    'code', s.code,
    'secret', s.secret,
    'expires_at', s.expires_at
  );
end $$;

-- Called by the logged-in owner (from the QR link) to claim a TV.
create or replace function public.claim_pairing_session(
  p_code text,
  p_name text,
  p_orientation text default 'landscape'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_restaurant uuid;
  v_session public.pairing_sessions;
  v_screen public.screens;
begin
  select id into v_restaurant from public.restaurants where owner_id = auth.uid();
  if v_restaurant is null then
    raise exception 'No restaurant found for this account.';
  end if;
  select * into v_session from public.pairing_sessions
    where code = upper(trim(p_code)) and status = 'pending' and expires_at > now()
    for update;
  if not found then
    raise exception 'Pairing code is invalid or has expired. Reload the TV player and try again.';
  end if;
  if (select count(*) from public.screens where restaurant_id = v_restaurant) >= 2 then
    raise exception 'Screen limit reached: your plan includes up to 2 screens.';
  end if;
  insert into public.screens (restaurant_id, name, orientation)
    values (v_restaurant, coalesce(nullif(trim(p_name), ''), 'New screen'),
            case when p_orientation = 'portrait' then 'portrait' else 'landscape' end)
    returning * into v_screen;
  update public.pairing_sessions
    set status = 'claimed', screen_id = v_screen.id where id = v_session.id;
  return jsonb_build_object('screen_id', v_screen.id, 'name', v_screen.name);
end $$;

-- Polled by the TV until the owner claims it.
create or replace function public.check_pairing_session(p_session uuid, p_secret uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.pairing_sessions;
  sc public.screens;
begin
  select * into s from public.pairing_sessions where id = p_session and secret = p_secret;
  if not found or (s.status = 'pending' and s.expires_at < now()) then
    return jsonb_build_object('status', 'expired');
  end if;
  if s.status = 'claimed' then
    select * into sc from public.screens where id = s.screen_id;
    if not found then
      return jsonb_build_object('status', 'expired');
    end if;
    delete from public.pairing_sessions where id = s.id;
    return jsonb_build_object(
      'status', 'claimed',
      'device_token', sc.device_token,
      'screen_id', sc.id,
      'name', sc.name,
      'orientation', sc.orientation
    );
  end if;
  return jsonb_build_object('status', 'pending');
end $$;

-- ------------------------------------------------------------------
-- Player content RPC: the screen's only data path, keyed by its
-- revocable device token. Also serves as the heartbeat.
-- ------------------------------------------------------------------

create or replace function public.menu_payload(m public.menus)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'template_id', m.template_id,
    'template_config', m.template_config,
    'orientation', m.orientation,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'menu_id', s.menu_id, 'name', s.name, 'sort_order', s.sort_order,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'section_id', i.section_id, 'name', i.name,
            'description', i.description, 'price', i.price,
            'image_url', i.image_url, 'available', i.available,
            'sort_order', i.sort_order
          ) order by i.sort_order, i.name)
          from public.menu_items i where i.section_id = s.id
        ), '[]'::jsonb)
      ) order by s.sort_order, s.name)
      from public.menu_sections s where s.menu_id = m.id
    ), '[]'::jsonb)
  )
$$;

create or replace function public.get_screen_content(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_screen public.screens;
  v_restaurant public.restaurants;
  v_slides jsonb := '[]'::jsonb;
begin
  select * into v_screen from public.screens where device_token = p_token;
  if not found then
    return jsonb_build_object('status', 'revoked');
  end if;

  update public.screens set last_seen_at = now() where id = v_screen.id;
  select * into v_restaurant from public.restaurants where id = v_screen.restaurant_id;

  if v_screen.assigned_playlist_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'duration_seconds', ps.duration_seconds,
      'transition', ps.transition,
      'menu', public.menu_payload(m.*)
    ) order by ps.sort_order), '[]'::jsonb)
    into v_slides
    from public.playlist_slides ps
    join public.menus m on m.id = ps.menu_id
    where ps.playlist_id = v_screen.assigned_playlist_id;
  elsif v_screen.assigned_menu_id is not null then
    select jsonb_build_array(jsonb_build_object(
      'duration_seconds', 0,
      'transition', 'fade',
      'menu', public.menu_payload(m.*)
    ))
    into v_slides
    from public.menus m where m.id = v_screen.assigned_menu_id;
    v_slides := coalesce(v_slides, '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'screen', jsonb_build_object(
      'id', v_screen.id, 'name', v_screen.name, 'orientation', v_screen.orientation
    ),
    'restaurant', jsonb_build_object(
      'name', v_restaurant.name,
      'logo_url', v_restaurant.logo_url,
      'brand_color', v_restaurant.brand_color,
      'currency', v_restaurant.currency
    ),
    'slides', v_slides
  );
end $$;

-- Lock down RPC execution
revoke all on function public.create_pairing_session() from public;
revoke all on function public.check_pairing_session(uuid, uuid) from public;
revoke all on function public.claim_pairing_session(text, text, text) from public;
revoke all on function public.get_screen_content(uuid) from public;
revoke all on function public.menu_payload(public.menus) from public;
revoke all on function public.broadcast_to_restaurant_screens(uuid) from public;

grant execute on function public.create_pairing_session() to anon, authenticated;
grant execute on function public.check_pairing_session(uuid, uuid) to anon, authenticated;
grant execute on function public.claim_pairing_session(text, text, text) to authenticated;
grant execute on function public.get_screen_content(uuid) to anon, authenticated;

-- ------------------------------------------------------------------
-- Storage: public bucket for menu item images & logos.
-- Files live under <restaurant_id>/... so writes can be owner-scoped.
-- ------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "menu images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'menu-images');

create policy "owners upload to their restaurant folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

create policy "owners delete from their restaurant folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );
