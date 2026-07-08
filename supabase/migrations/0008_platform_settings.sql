-- SyncMenu migration 0008 — platform settings + tenant admin controls.
-- Run after 0007_plan_pricing_limits.sql.

-- ------------------------------------------------------------------
-- Platform-wide settings (single row)
-- ------------------------------------------------------------------

create table public.platform_settings (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.platform_settings enable row level security;

insert into public.platform_settings (id, config)
values (
  1,
  jsonb_build_object(
    'trial_days', 14,
    'max_admins', 3,
    'support_email', 'support@syncmenuapp.com',
    'site_url', 'https://syncmenuapp.com',
    'plan_limits', jsonb_build_object(
      'trial', jsonb_build_object('screens', 5, 'menus', 10),
      'starter', jsonb_build_object('screens', 1, 'menus', 5),
      'growth', jsonb_build_object('screens', 5, 'menus', 10),
      'pro', jsonb_build_object('screens', 10, 'menus', 999)
    ),
    'pricing', jsonb_build_object(
      'starter', jsonb_build_object('monthly', 15, 'annualMonthly', 12),
      'growth', jsonb_build_object('monthly', 30, 'annualMonthly', 25),
      'pro', jsonb_build_object('monthly', 99, 'annualMonthly', 82)
    )
  )
)
on conflict (id) do nothing;

-- Per-tenant limit overrides (optional)
alter table public.restaurants
  add column if not exists screen_limit_override int check (screen_limit_override is null or screen_limit_override > 0);

alter table public.restaurants
  add column if not exists menu_limit_override int check (menu_limit_override is null or menu_limit_override > 0);

-- ------------------------------------------------------------------
-- Settings helpers
-- ------------------------------------------------------------------

create or replace function public.platform_settings_config()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select config from public.platform_settings where id = 1),
    '{}'::jsonb
  );
$$;

create or replace function public.platform_plan_limit(p_plan text, p_field text)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (public.platform_settings_config()->'plan_limits'->p_plan->>p_field)::int,
    case
      when p_plan = 'starter' and p_field = 'screens' then 1
      when p_plan = 'starter' and p_field = 'menus' then 5
      when p_plan = 'growth' and p_field = 'screens' then 5
      when p_plan = 'growth' and p_field = 'menus' then 10
      when p_plan = 'pro' and p_field = 'screens' then 10
      when p_plan = 'pro' and p_field = 'menus' then 999
      when p_plan = 'trial' and p_field = 'screens' then 5
      when p_plan = 'trial' and p_field = 'menus' then 10
      else 5
    end
  );
$$;

create or replace function public.restaurant_plan_limits(p_restaurant_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_plan text;
  v_subscribed boolean;
  v_on_trial boolean;
  v_screen_override int;
  v_menu_override int;
begin
  select r.screen_limit_override, r.menu_limit_override
  into v_screen_override, v_menu_override
  from public.restaurants r
  where r.id = p_restaurant_id;

  if v_screen_override is not null or v_menu_override is not null then
    return jsonb_build_object(
      'screens', coalesce(v_screen_override, public.platform_plan_limit('trial', 'screens')),
      'menus', coalesce(v_menu_override, public.platform_plan_limit('trial', 'menus'))
    );
  end if;

  select s.plan_id, true
  into v_plan, v_subscribed
  from public.subscriptions s
  where s.restaurant_id = p_restaurant_id
    and s.status in ('active', 'trialing')
  limit 1;

  if v_subscribed and v_plan is not null then
    return jsonb_build_object(
      'screens', public.platform_plan_limit(v_plan, 'screens'),
      'menus', public.platform_plan_limit(v_plan, 'menus')
    );
  end if;

  select exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id and r.trial_ends_at > now()
  ) into v_on_trial;

  if v_on_trial then
    return jsonb_build_object(
      'screens', public.platform_plan_limit('trial', 'screens'),
      'menus', public.platform_plan_limit('trial', 'menus')
    );
  end if;

  return jsonb_build_object(
    'screens', public.platform_plan_limit('trial', 'screens'),
    'menus', public.platform_plan_limit('trial', 'menus')
  );
end;
$$;

-- New restaurants: trial length from platform settings
create or replace function public.restaurants_set_trial_from_settings()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_days int;
begin
  v_days := coalesce((public.platform_settings_config()->>'trial_days')::int, 14);
  new.trial_ends_at := now() + (greatest(1, least(v_days, 365)) || ' days')::interval;
  return new;
end;
$$;

drop trigger if exists restaurants_trial_from_settings on public.restaurants;
create trigger restaurants_trial_from_settings
  before insert on public.restaurants
  for each row execute function public.restaurants_set_trial_from_settings();

-- ------------------------------------------------------------------
-- Public + admin settings RPCs
-- ------------------------------------------------------------------

create or replace function public.get_platform_settings()
returns jsonb language sql stable security definer set search_path = public as $$
  select public.platform_settings_config();
$$;

create or replace function public.admin_get_platform_settings()
returns jsonb language sql security definer set search_path = public as $$
  select case when public.is_platform_admin() then public.platform_settings_config() else null end;
$$;

create or replace function public.admin_update_platform_settings(p_config jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_merged jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  update public.platform_settings
  set
    config = coalesce(config, '{}'::jsonb) || p_config,
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1
  returning config into v_merged;

  perform public.log_admin_action(
    'update_platform_settings',
    'platform_settings',
    null,
    p_config
  );

  return v_merged;
end;
$$;

-- ------------------------------------------------------------------
-- Tenant admin: edit profile, limits, comp plan
-- ------------------------------------------------------------------

create or replace function public.admin_update_tenant(
  p_id uuid,
  p_name text default null,
  p_currency text default null,
  p_trial_ends_at timestamptz default null,
  p_screen_limit_override int default null,
  p_menu_limit_override int default null,
  p_clear_limit_overrides boolean default false
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  update public.restaurants set
    name = coalesce(nullif(trim(p_name), ''), name),
    currency = coalesce(nullif(trim(p_currency), ''), currency),
    trial_ends_at = coalesce(p_trial_ends_at, trial_ends_at),
    screen_limit_override = case
      when p_clear_limit_overrides then null
      when p_screen_limit_override is not null then greatest(1, p_screen_limit_override)
      else screen_limit_override
    end,
    menu_limit_override = case
      when p_clear_limit_overrides then null
      when p_menu_limit_override is not null then greatest(1, p_menu_limit_override)
      else menu_limit_override
    end
  where id = p_id;

  if not found then raise exception 'Restaurant not found'; end if;

  perform public.log_admin_action(
    'update_tenant',
    'restaurant',
    p_id,
    jsonb_build_object(
      'name', p_name,
      'currency', p_currency,
      'trial_ends_at', p_trial_ends_at,
      'screen_limit_override', p_screen_limit_override,
      'menu_limit_override', p_menu_limit_override,
      'clear_limit_overrides', p_clear_limit_overrides
    )
  );
end;
$$;

create or replace function public.admin_set_tenant_plan(
  p_restaurant_id uuid,
  p_plan_id text,
  p_status text default 'active'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if p_plan_id not in ('starter', 'growth', 'pro') then
    raise exception 'Invalid plan_id';
  end if;
  if p_status not in ('active', 'trialing', 'canceled') then
    raise exception 'Invalid status';
  end if;

  insert into public.subscriptions (restaurant_id, plan_id, status, updated_at)
  values (p_restaurant_id, p_plan_id, p_status, now())
  on conflict (restaurant_id) do update set
    plan_id = excluded.plan_id,
    status = excluded.status,
    updated_at = now();

  perform public.log_admin_action(
    'set_tenant_plan',
    'restaurant',
    p_restaurant_id,
    jsonb_build_object('plan_id', p_plan_id, 'status', p_status)
  );
end;
$$;

create or replace function public.admin_clear_tenant_subscription(p_restaurant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  update public.subscriptions set
    plan_id = null,
    status = null,
    stripe_subscription_id = null,
    price_id = null,
    current_period_end = null,
    updated_at = now()
  where restaurant_id = p_restaurant_id;

  perform public.log_admin_action(
    'clear_tenant_subscription',
    'restaurant',
    p_restaurant_id,
    null
  );
end;
$$;

-- Dynamic max admins from settings
create or replace function public.admin_manage_admin(p_action text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_count int;
  v_max int;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  v_max := coalesce((public.platform_settings_config()->>'max_admins')::int, 3);

  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'No user with that email'; end if;

  if p_action = 'add' then
    select count(*) into v_count from public.platform_admins;
    if v_count >= v_max then raise exception 'Maximum of % platform admins', v_max; end if;
    insert into public.platform_admins (user_id, email, created_by)
    values (v_user, lower(trim(p_email)), auth.uid())
    on conflict (user_id) do nothing;
    perform public.log_admin_action('add_admin', 'user', v_user, jsonb_build_object('email', p_email));
  elsif p_action = 'remove' then
    if v_user = auth.uid() then raise exception 'Cannot remove yourself'; end if;
    delete from public.platform_admins where user_id = v_user;
    perform public.log_admin_action('remove_admin', 'user', v_user, jsonb_build_object('email', p_email));
  else
    raise exception 'Unknown action';
  end if;
end;
$$;

-- Extend admin_get_tenant with override fields
create or replace function public.admin_get_tenant(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  select jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'status', r.status,
    'suspended_at', r.suspended_at,
    'suspended_reason', r.suspended_reason,
    'trial_ends_at', r.trial_ends_at,
    'created_at', r.created_at,
    'brand_color', r.brand_color,
    'currency', r.currency,
    'owner_id', r.owner_id,
    'owner_email', u.email,
    'screen_limit_override', r.screen_limit_override,
    'menu_limit_override', r.menu_limit_override,
    'subscription', (
      select jsonb_build_object(
        'plan_id', s.plan_id,
        'status', s.status,
        'stripe_customer_id', s.stripe_customer_id,
        'stripe_subscription_id', s.stripe_subscription_id,
        'current_period_end', s.current_period_end
      )
      from public.subscriptions s where s.restaurant_id = r.id
    ),
    'screen_count', (select count(*) from public.screens sc where sc.restaurant_id = r.id),
    'menu_count', (select count(*) from public.menus m where m.restaurant_id = r.id),
    'effective_limits', public.restaurant_plan_limits(r.id)
  ) into v_row
  from public.restaurants r
  join auth.users u on u.id = r.owner_id
  where r.id = p_id;

  if v_row is null then raise exception 'Restaurant not found'; end if;
  return v_row;
end;
$$;

-- Grants
grant execute on function public.get_platform_settings() to anon, authenticated;
grant execute on function public.admin_get_platform_settings() to authenticated;
grant execute on function public.admin_update_platform_settings(jsonb) to authenticated;
grant execute on function public.admin_update_tenant(uuid, text, text, timestamptz, int, int, boolean) to authenticated;
grant execute on function public.admin_set_tenant_plan(uuid, text, text) to authenticated;
grant execute on function public.restaurant_plan_limits(uuid) to authenticated;
