-- Media assets for GIF/video promo slides and in-board media elements.

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('image', 'gif', 'video')),
  url text not null,
  mime_type text not null,
  file_size_bytes bigint not null default 0,
  duration_seconds numeric,
  thumbnail_url text,
  link_url text,
  show_qr boolean not null default false,
  created_at timestamptz not null default now()
);

create index media_assets_restaurant_idx on public.media_assets (restaurant_id);

alter table public.media_assets enable row level security;

create policy media_assets_owner on public.media_assets
  for all using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  ) with check (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

-- Extend playlist slides: menu OR media
alter table public.playlist_slides
  add column slide_type text not null default 'menu'
    check (slide_type in ('menu', 'media')),
  add column media_id uuid references public.media_assets(id) on delete cascade;

alter table public.playlist_slides
  alter column menu_id drop not null;

alter table public.playlist_slides
  add constraint playlist_slides_type_check check (
    (slide_type = 'menu' and menu_id is not null and media_id is null)
    or (slide_type = 'media' and media_id is not null and menu_id is null)
  );

-- Broadcast when media assets change
create or replace function public.trg_broadcast_media_assets()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.broadcast_to_restaurant_screens(coalesce(new.restaurant_id, old.restaurant_id));
  return coalesce(new, old);
end $$;

create trigger media_assets_broadcast after insert or update or delete on public.media_assets
  for each row execute function public.trg_broadcast_media_assets();

-- Player content: include media slides in playlists
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

  if v_restaurant.status = 'suspended' then
    return jsonb_build_object('status', 'suspended');
  end if;

  if not public.restaurant_has_player_access(v_restaurant.id) then
    return jsonb_build_object('status', 'trial_expired');
  end if;

  if v_screen.assigned_playlist_id is not null then
    select coalesce(jsonb_agg(
      case when ps.slide_type = 'media' then
        jsonb_build_object(
          'slide_type', 'media',
          'duration_seconds', ps.duration_seconds,
          'transition', ps.transition,
          'media', jsonb_build_object(
            'id', ma.id,
            'name', ma.name,
            'kind', ma.kind,
            'url', ma.url,
            'thumbnail_url', ma.thumbnail_url,
            'link_url', ma.link_url,
            'show_qr', ma.show_qr
          )
        )
      else
        jsonb_build_object(
          'slide_type', 'menu',
          'duration_seconds', ps.duration_seconds,
          'transition', ps.transition,
          'menu', public.menu_payload(m.*)
        )
      end
    order by ps.sort_order), '[]'::jsonb)
    into v_slides
    from public.playlist_slides ps
    left join public.menus m on m.id = ps.menu_id and ps.slide_type = 'menu'
    left join public.media_assets ma on ma.id = ps.media_id and ps.slide_type = 'media'
    where ps.playlist_id = v_screen.assigned_playlist_id;
  elsif v_screen.assigned_menu_id is not null then
    select jsonb_build_array(jsonb_build_object(
      'slide_type', 'menu',
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
