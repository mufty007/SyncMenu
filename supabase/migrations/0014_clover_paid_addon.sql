-- SyncMenu migration 0014 — paid Clover add-on entitlements and enforcement.
-- Run after 0013_media_signage.sql.

-- Display pricing. Stripe remains the source of truth for actual charges.
update public.platform_settings
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{clover,pricing}',
  coalesce(config->'clover'->'pricing', '{}'::jsonb) || jsonb_build_object(
    'monthly', 20,
    'annualMonthly', 16
  ),
  true
)
where id = 1;

-- ------------------------------------------------------------------
-- Persistent per-restaurant add-on state (written by Stripe services)
-- ------------------------------------------------------------------

create table public.subscription_addons (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  addon_id text not null check (addon_id in ('clover')),
  stripe_subscription_id text not null,
  stripe_subscription_item_id text not null unique,
  price_id text not null,
  status text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, addon_id)
);

create index subscription_addons_subscription_idx
  on public.subscription_addons (stripe_subscription_id);

alter table public.subscription_addons enable row level security;

create policy subscription_addons_owner_read on public.subscription_addons
  for select
  to authenticated
  using (
    restaurant_id in (
      select r.id from public.restaurants r where r.owner_id = (select auth.uid())
    )
  );

grant select on public.subscription_addons to authenticated;

-- ------------------------------------------------------------------
-- Entitlement helpers
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

create or replace function public.restaurant_addon_enabled(
  p_restaurant_id uuid,
  p_addon_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when p_addon_id = 'clover' then
        coalesce(
          (public.platform_settings_config()->'clover'->>'enabled')::boolean,
          false
        )
        and public.restaurant_has_paid_addon(p_restaurant_id, p_addon_id)
      else false
    end;
$$;

revoke all on function public.restaurant_has_paid_addon(uuid, text)
  from public, anon, authenticated;
revoke all on function public.restaurant_addon_enabled(uuid, text)
  from public, anon, authenticated;
grant execute on function public.restaurant_has_paid_addon(uuid, text) to service_role;
grant execute on function public.restaurant_addon_enabled(uuid, text) to service_role;

-- Never expose Clover credentials or secrets through the public settings RPC.
create or replace function public.get_platform_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'trial_days', coalesce((public.platform_settings_config()->>'trial_days')::int, 14),
    'max_admins', coalesce((public.platform_settings_config()->>'max_admins')::int, 3),
    'support_email', coalesce(public.platform_settings_config()->>'support_email', 'support@syncmenuapp.com'),
    'site_url', coalesce(public.platform_settings_config()->>'site_url', 'https://syncmenuapp.com'),
    'plan_limits', coalesce(public.platform_settings_config()->'plan_limits', '{}'::jsonb),
    'pricing', coalesce(public.platform_settings_config()->'pricing', '{}'::jsonb),
    'clover', jsonb_build_object(
      'enabled', coalesce(
        (public.platform_settings_config()->'clover'->>'enabled')::boolean,
        false
      ),
      'pricing', coalesce(
        public.platform_settings_config()->'clover'->'pricing',
        jsonb_build_object('monthly', 20, 'annualMonthly', 16)
      )
    )
  );
$$;

-- Deep-merge the public Clover fields so pricing edits cannot erase credentials.
create or replace function public.admin_update_platform_settings(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current jsonb;
  v_merged jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  select coalesce(config, '{}'::jsonb)
  into v_current
  from public.platform_settings
  where id = 1
  for update;

  v_merged := v_current || (coalesce(p_config, '{}'::jsonb) - 'clover');
  if coalesce(p_config, '{}'::jsonb) ? 'clover' then
    v_merged := jsonb_set(
      v_merged,
      '{clover}',
      coalesce(v_current->'clover', '{}'::jsonb) || coalesce(p_config->'clover', '{}'::jsonb),
      true
    );
  end if;

  update public.platform_settings
  set config = v_merged,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

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
-- Clover owner RPCs and queue paths now require the paid entitlement
-- ------------------------------------------------------------------

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
    'last_full_sync_at', v_row.last_full_sync_at,
    'last_push_at', v_row.last_push_at,
    'last_error', v_row.last_error,
    'connected', v_row.status in ('pending', 'active', 'error')
  );
end;
$$;

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

  insert into public.clover_sync_queue (restaurant_id, job_type, payload)
  values (
    v_restaurant_id,
    'full_push',
    jsonb_build_object('reason', 'delivery_menu_changed')
  );

  return public.get_clover_integration();
end;
$$;

create or replace function public.enqueue_clover_sync_job(
  p_restaurant_id uuid,
  p_job_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.restaurant_addon_enabled(p_restaurant_id, 'clover') then
    return;
  end if;

  insert into public.clover_sync_queue (restaurant_id, job_type, payload)
  values (p_restaurant_id, p_job_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;

create or replace function public.clover_delivery_menu_id(p_menu_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ci.delivery_menu_id
  from public.clover_integrations ci
  join public.menus m on m.restaurant_id = ci.restaurant_id
  where m.id = p_menu_id
    and ci.status = 'active'
    and ci.delivery_menu_id = p_menu_id
    and public.restaurant_addon_enabled(ci.restaurant_id, 'clover')
  limit 1;
$$;

-- Replace nightly reconciliation so disabled/unentitled restaurants are skipped.
do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'clover-nightly-reconcile') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'clover-nightly-reconcile';
  end if;
exception when undefined_table then
  null;
end;
$cron$;

select cron.schedule(
  'clover-nightly-reconcile',
  '0 5 * * *',
  $$
  insert into public.clover_sync_queue (restaurant_id, job_type, payload)
  select ci.restaurant_id, 'full_push', '{"reason":"nightly_reconcile"}'::jsonb
  from public.clover_integrations ci
  where ci.status = 'active'
    and ci.delivery_menu_id is not null
    and public.restaurant_addon_enabled(ci.restaurant_id, 'clover');
  $$
);

grant execute on function public.get_platform_settings() to anon, authenticated;
grant execute on function public.admin_update_platform_settings(jsonb) to authenticated;
grant execute on function public.get_clover_integration() to authenticated;
grant execute on function public.set_clover_delivery_menu(uuid) to authenticated;
grant execute on function public.enqueue_clover_sync_job(uuid, text, jsonb) to service_role;
