-- SyncMenu migration 0006 — plan limits, trial/suspend enforcement on player + pairing.

-- Plan limit helpers (keep in sync with src/lib/types.ts PLAN_LIMITS_BY_PLAN)
create or replace function public.restaurant_plan_limits(p_restaurant_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select jsonb_build_object(
        'screens',
        case s.plan_id
          when 'starter' then 1
          when 'growth' then 2
          when 'pro' then 5
          else 2
        end,
        'menus',
        case s.plan_id
          when 'starter' then 5
          when 'growth' then 10
          when 'pro' then 999
          else 10
        end
      )
      from public.subscriptions s
      where s.restaurant_id = p_restaurant_id
        and s.status in ('active', 'trialing')
    ),
    jsonb_build_object('screens', 2, 'menus', 10)
  );
$$;

create or replace function public.restaurant_has_player_access(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id
      and r.status = 'active'
      and (
        r.trial_ends_at > now()
        or exists (
          select 1 from public.subscriptions s
          where s.restaurant_id = r.id and s.status in ('active', 'trialing')
        )
      )
  );
$$;

-- Block suspended restaurants from pairing new screens
create or replace function public.claim_pairing_session(
  p_code text,
  p_name text,
  p_orientation text default 'landscape'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_restaurant uuid;
  v_session public.pairing_sessions;
  v_screen public.screens;
  v_limits jsonb;
  v_screen_limit int;
  v_screen_count int;
begin
  select id into v_restaurant from public.restaurants where owner_id = auth.uid();
  if v_restaurant is null then
    raise exception 'No restaurant found for this account.';
  end if;

  if exists (select 1 from public.restaurants where id = v_restaurant and status = 'suspended') then
    raise exception 'Account suspended — contact SyncMenu support.';
  end if;

  if not public.restaurant_has_player_access(v_restaurant) then
    raise exception 'Trial ended — subscribe to add screens.';
  end if;

  v_limits := public.restaurant_plan_limits(v_restaurant);
  v_screen_limit := (v_limits->>'screens')::int;
  select count(*) into v_screen_count from public.screens where restaurant_id = v_restaurant;

  if v_screen_count >= v_screen_limit then
    raise exception 'Screen limit reached: your plan includes up to % screens.', v_screen_limit;
  end if;

  select * into v_session from public.pairing_sessions
    where code = upper(trim(p_code)) and status = 'pending' and expires_at > now()
    for update;
  if not found then
    raise exception 'Pairing code is invalid or has expired. Reload the TV player and try again.';
  end if;

  insert into public.screens (restaurant_id, name, orientation)
    values (v_restaurant, coalesce(nullif(trim(p_name), ''), 'New screen'),
            case when p_orientation = 'portrait' then 'portrait' else 'landscape' end)
    returning * into v_screen;
  update public.pairing_sessions
    set status = 'claimed', screen_id = v_screen.id where id = v_session.id;
  return jsonb_build_object('screen_id', v_screen.id, 'name', v_screen.name);
end;
$$;

-- Menu limit on insert
create or replace function public.enforce_menu_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_limit int;
begin
  select count(*) into v_count from public.menus where restaurant_id = new.restaurant_id;
  v_limit := (public.restaurant_plan_limits(new.restaurant_id)->>'menus')::int;
  if v_count >= v_limit then
    raise exception 'Menu limit reached: your plan includes up to % saved menus.', v_limit;
  end if;
  return new;
end;
$$;

drop trigger if exists menus_limit_check on public.menus;
create trigger menus_limit_check
  before insert on public.menus
  for each row execute function public.enforce_menu_limit();

-- Player content: suspend + trial gates
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
end;
$$;
