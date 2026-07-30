-- SyncMenu migration 0015 — admin-granted Clover add-on + import tracking.
-- Run after 0014_clover_paid_addon.sql.

-- ------------------------------------------------------------------
-- Allow admin grants without Stripe IDs
-- ------------------------------------------------------------------

alter table public.subscription_addons
  add column if not exists source text not null default 'stripe'
    check (source in ('stripe', 'admin_grant'));

alter table public.subscription_addons
  alter column stripe_subscription_id drop not null;

alter table public.subscription_addons
  alter column stripe_subscription_item_id drop not null;

alter table public.subscription_addons
  alter column price_id drop not null;

-- Unique stripe item id only when present (admin grants use null)
alter table public.subscription_addons
  drop constraint if exists subscription_addons_stripe_subscription_item_id_key;

create unique index if not exists subscription_addons_stripe_item_uidx
  on public.subscription_addons (stripe_subscription_item_id)
  where stripe_subscription_item_id is not null;

-- ------------------------------------------------------------------
-- Import tracking on clover_integrations
-- ------------------------------------------------------------------

alter table public.clover_integrations
  add column if not exists imported_menu_id uuid references public.menus(id) on delete set null;

alter table public.clover_integrations
  add column if not exists initial_import_status text not null default 'idle'
    check (initial_import_status in ('idle', 'running', 'done', 'error'));

alter table public.clover_integrations
  add column if not exists last_import_at timestamptz;

alter table public.clover_integrations
  add column if not exists last_import_error text;

-- ------------------------------------------------------------------
-- Entitlement: Stripe OR admin grant
-- ------------------------------------------------------------------

create or replace function public.restaurant_has_paid_addon(
  p_restaurant_id uuid,
  p_addon_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscription_addons sa
    where sa.restaurant_id = p_restaurant_id
      and sa.addon_id = p_addon_id
      and sa.status in ('active', 'trialing')
  );
$$;

-- ------------------------------------------------------------------
-- Admin grant / revoke Clover add-on
-- ------------------------------------------------------------------

create or replace function public.admin_get_restaurant_addon(
  p_restaurant_id uuid,
  p_addon_id text default 'clover'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.subscription_addons;
  v_feature boolean;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  v_feature := coalesce(
    (public.platform_settings_config()->'clover'->>'enabled')::boolean,
    false
  );

  select * into v_row
  from public.subscription_addons
  where restaurant_id = p_restaurant_id and addon_id = p_addon_id;

  if not found then
    return jsonb_build_object(
      'addon_id', p_addon_id,
      'entitled', false,
      'feature_enabled', v_feature,
      'available', false,
      'source', null,
      'status', null
    );
  end if;

  return jsonb_build_object(
    'addon_id', p_addon_id,
    'entitled', v_row.status in ('active', 'trialing'),
    'feature_enabled', v_feature,
    'available', v_feature and v_row.status in ('active', 'trialing'),
    'source', v_row.source,
    'status', v_row.status,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.admin_set_restaurant_addon(
  p_restaurant_id uuid,
  p_addon_id text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.subscription_addons;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if p_addon_id is distinct from 'clover' then
    raise exception 'Unsupported add-on';
  end if;
  if not exists (select 1 from public.restaurants where id = p_restaurant_id) then
    raise exception 'Restaurant not found';
  end if;

  select * into v_existing
  from public.subscription_addons
  where restaurant_id = p_restaurant_id and addon_id = p_addon_id;

  if p_enabled then
    if found and v_existing.source = 'stripe' and v_existing.status in ('active', 'trialing') then
      -- Already entitled via Stripe; leave alone
      null;
    elsif found then
      update public.subscription_addons
      set status = 'active',
          source = 'admin_grant',
          updated_at = now()
      where restaurant_id = p_restaurant_id and addon_id = p_addon_id;
    else
      insert into public.subscription_addons (
        restaurant_id, addon_id, source, status,
        stripe_subscription_id, stripe_subscription_item_id, price_id, updated_at
      ) values (
        p_restaurant_id, p_addon_id, 'admin_grant', 'active',
        null, null, null, now()
      );
    end if;
  else
    if found and v_existing.source = 'admin_grant' then
      update public.subscription_addons
      set status = 'canceled', updated_at = now()
      where restaurant_id = p_restaurant_id and addon_id = p_addon_id;
    elsif found and v_existing.source = 'stripe' then
      raise exception 'This add-on is billed via Stripe — cancel it in Stripe or clear the sub record first';
    end if;
  end if;

  perform public.log_admin_action(
    case when p_enabled then 'grant_addon' else 'revoke_addon' end,
    'restaurant',
    p_restaurant_id,
    jsonb_build_object('addon_id', p_addon_id, 'enabled', p_enabled)
  );

  return public.admin_get_restaurant_addon(p_restaurant_id, p_addon_id);
end;
$$;

-- Enrich tenant clover status with entitlement + import fields
create or replace function public.admin_get_tenant_clover(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ci public.clover_integrations;
  v_addon jsonb;
begin
  if not public.is_platform_admin() then return null; end if;

  v_addon := public.admin_get_restaurant_addon(p_restaurant_id, 'clover');

  select * into v_ci
  from public.clover_integrations
  where restaurant_id = p_restaurant_id;

  if not found then
    return jsonb_build_object(
      'connected', false,
      'addon', v_addon
    );
  end if;

  return jsonb_build_object(
    'connected', true,
    'status', v_ci.status,
    'clover_merchant_id', v_ci.clover_merchant_id,
    'delivery_menu_id', v_ci.delivery_menu_id,
    'imported_menu_id', v_ci.imported_menu_id,
    'initial_import_status', v_ci.initial_import_status,
    'last_import_at', v_ci.last_import_at,
    'last_import_error', v_ci.last_import_error,
    'last_full_sync_at', v_ci.last_full_sync_at,
    'last_push_at', v_ci.last_push_at,
    'last_error', v_ci.last_error,
    'addon', v_addon
  );
end;
$$;

-- Owner integration payload includes import fields; no auto-push on menu select
create or replace function public.get_clover_integration()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_row public.clover_integrations;
  v_feature_enabled boolean;
  v_entitled boolean;
begin
  select id into v_restaurant_id
  from public.restaurants
  where owner_id = auth.uid()
  limit 1;

  if v_restaurant_id is null then
    return jsonb_build_object('status', 'no_restaurant');
  end if;

  v_feature_enabled := coalesce(
    (public.platform_settings_config()->'clover'->>'enabled')::boolean,
    false
  );
  v_entitled := public.restaurant_has_paid_addon(v_restaurant_id, 'clover');

  select * into v_row
  from public.clover_integrations
  where restaurant_id = v_restaurant_id;

  if not found then
    return jsonb_build_object(
      'status', 'not_connected',
      'feature_enabled', v_feature_enabled,
      'entitled', v_entitled,
      'available', v_feature_enabled and v_entitled,
      'connected', false
    );
  end if;

  return jsonb_build_object(
    'status', v_row.status,
    'feature_enabled', v_feature_enabled,
    'entitled', v_entitled,
    'available', v_feature_enabled and v_entitled,
    'clover_merchant_id', v_row.clover_merchant_id,
    'delivery_menu_id', v_row.delivery_menu_id,
    'imported_menu_id', v_row.imported_menu_id,
    'initial_import_status', v_row.initial_import_status,
    'last_import_at', v_row.last_import_at,
    'last_import_error', v_row.last_import_error,
    'last_full_sync_at', v_row.last_full_sync_at,
    'last_push_at', v_row.last_push_at,
    'last_error', v_row.last_error,
    'connected', v_row.status in ('pending', 'active', 'error')
  );
end;
$$;

-- Selecting a delivery menu must NOT enqueue a push (owner confirms separately)
create or replace function public.set_clover_delivery_menu(p_menu_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_menu public.menus;
begin
  select id into v_restaurant_id
  from public.restaurants
  where owner_id = auth.uid()
  limit 1;

  if v_restaurant_id is null then raise exception 'No restaurant'; end if;
  if not public.restaurant_addon_enabled(v_restaurant_id, 'clover') then
    raise exception 'An active Clover add-on is required';
  end if;

  select * into v_menu
  from public.menus
  where id = p_menu_id and restaurant_id = v_restaurant_id;
  if not found then raise exception 'Menu not found'; end if;

  update public.clover_integrations
  set delivery_menu_id = p_menu_id, updated_at = now()
  where restaurant_id = v_restaurant_id;
  if not found then raise exception 'Clover not connected'; end if;

  return public.get_clover_integration();
end;
$$;

-- Grant restaurant_has_paid_addon to authenticated for owner UI checks via RPC wrappers only;
-- keep direct execute on service_role; admin RPCs use security definer.

grant execute on function public.admin_set_restaurant_addon(uuid, text, boolean) to authenticated;
grant execute on function public.admin_get_restaurant_addon(uuid, text) to authenticated;
grant execute on function public.admin_get_tenant_clover(uuid) to authenticated;
grant execute on function public.get_clover_integration() to authenticated;
grant execute on function public.set_clover_delivery_menu(uuid) to authenticated;
grant execute on function public.restaurant_has_paid_addon(uuid, text) to service_role;
grant execute on function public.restaurant_addon_enabled(uuid, text) to service_role;
