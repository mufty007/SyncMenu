-- SyncMenu migration 0012 — Clover push integration (SyncMenu → Clover → delivery apps).
-- Run after 0011_cron_secret_fix.sql.

-- Seed clover config defaults
update public.platform_settings
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{clover}',
  coalesce(config->'clover', '{}'::jsonb) || jsonb_build_object(
    'environment', 'sandbox',
    'enabled', false
  ),
  true
)
where id = 1;

-- ------------------------------------------------------------------
-- Integration tables
-- ------------------------------------------------------------------

create table public.clover_integrations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  clover_merchant_id text not null,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null default now(),
  delivery_menu_id uuid references public.menus(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'error', 'disconnected')),
  last_full_sync_at timestamptz,
  last_push_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id)
);

create table public.clover_entity_map (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.clover_integrations(id) on delete cascade,
  entity_type text not null check (entity_type in ('category', 'item')),
  syncmenu_id uuid not null,
  clover_id text not null,
  unique (integration_id, entity_type, syncmenu_id),
  unique (integration_id, clover_id)
);

create index clover_entity_map_integration_idx on public.clover_entity_map (integration_id);

create table public.clover_sync_queue (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  job_type text not null
    check (job_type in ('full_push', 'item_upsert', 'item_delete', 'section_upsert', 'section_delete')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts int not null default 0,
  last_error text
);

create index clover_sync_queue_pending_idx
  on public.clover_sync_queue (created_at)
  where processed_at is null;

create table public.clover_sync_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  action text not null,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index clover_sync_log_restaurant_idx on public.clover_sync_log (restaurant_id, created_at desc);

alter table public.clover_integrations enable row level security;
alter table public.clover_entity_map enable row level security;
alter table public.clover_sync_queue enable row level security;
alter table public.clover_sync_log enable row level security;

-- Owners see integration status (no tokens)
create policy clover_integrations_owner_read on public.clover_integrations
  for select using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create policy clover_sync_log_owner_read on public.clover_sync_log
  for select using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );

create trigger clover_integrations_touch before update on public.clover_integrations
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------
-- Platform admin — Clover app credentials
-- ------------------------------------------------------------------

create or replace function public.clover_oauth_redirect_uri()
returns text language sql stable as $$
  select 'https://hhncgqdqnznnlcoswmrm.supabase.co/functions/v1/clover-oauth-callback';
$$;

create or replace function public.admin_get_clover_settings()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_clover jsonb;
  v_secret text;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  v_clover := coalesce(public.platform_settings_config()->'clover', '{}'::jsonb);
  v_secret := v_clover->>'app_secret';

  return jsonb_build_object(
    'app_id', coalesce(v_clover->>'app_id', ''),
    'app_secret_masked', public.mask_secret(v_secret),
    'app_secret_set', v_secret is not null and v_secret <> '',
    'environment', coalesce(v_clover->>'environment', 'sandbox'),
    'oauth_state_secret_set', coalesce(v_clover->>'oauth_state_secret', '') <> '',
    'enabled', coalesce((v_clover->>'enabled')::boolean, false),
    'oauth_redirect_uri', public.clover_oauth_redirect_uri(),
    'configured', coalesce(v_clover->>'app_id', '') <> ''
      and v_secret is not null and v_secret <> ''
      and coalesce(v_clover->>'oauth_state_secret', '') <> '',
    'ready', coalesce(v_clover->>'app_id', '') <> ''
      and v_secret is not null and v_secret <> ''
      and coalesce(v_clover->>'oauth_state_secret', '') <> ''
      and coalesce((v_clover->>'enabled')::boolean, false)
  );
end;
$$;

create or replace function public.admin_update_clover_settings(p_clover jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_current jsonb;
  v_merged jsonb;
  v_new_secret text;
  v_new_state text;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  v_current := coalesce(public.platform_settings_config()->'clover', '{}'::jsonb);
  v_merged := v_current || p_clover;

  v_new_secret := p_clover->>'app_secret';
  if v_new_secret is null or v_new_secret = '' or v_new_secret like '••••%' then
    v_merged := v_merged - 'app_secret';
    if v_current ? 'app_secret' then
      v_merged := v_merged || jsonb_build_object('app_secret', v_current->>'app_secret');
    end if;
  end if;

  v_new_state := p_clover->>'oauth_state_secret';
  if p_clover ? 'oauth_state_secret' then
    if nullif(v_new_state, '') is null then
      v_merged := v_merged - 'oauth_state_secret';
      if v_current ? 'oauth_state_secret' then
        v_merged := v_merged || jsonb_build_object('oauth_state_secret', v_current->>'oauth_state_secret');
      end if;
    end if;
  end if;

  update public.platform_settings
  set config = jsonb_set(coalesce(config, '{}'::jsonb), '{clover}', v_merged, true),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  perform public.log_admin_action('update_clover_settings', 'platform_settings', null, jsonb_build_object(
    'environment', v_merged->>'environment',
    'enabled', v_merged->>'enabled'
  ));

  return public.admin_get_clover_settings();
end;
$$;

create or replace function public.service_clover_config()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(public.platform_settings_config()->'clover', '{}'::jsonb);
$$;

-- Public feature flag for owner UI (no secrets)
create or replace function public.get_clover_feature_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', coalesce((public.platform_settings_config()->'clover'->>'enabled')::boolean, false)
  );
$$;

-- ------------------------------------------------------------------
-- Owner integration RPCs
-- ------------------------------------------------------------------

create or replace function public.get_clover_integration()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_restaurant_id uuid;
  v_row public.clover_integrations;
begin
  select id into v_restaurant_id from public.restaurants where owner_id = auth.uid() limit 1;
  if v_restaurant_id is null then
    return jsonb_build_object('status', 'no_restaurant');
  end if;

  select * into v_row from public.clover_integrations where restaurant_id = v_restaurant_id;

  if not found then
    return jsonb_build_object(
      'status', 'not_connected',
      'feature_enabled', coalesce((public.platform_settings_config()->'clover'->>'enabled')::boolean, false)
    );
  end if;

  return jsonb_build_object(
    'status', v_row.status,
    'feature_enabled', coalesce((public.platform_settings_config()->'clover'->>'enabled')::boolean, false),
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
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_restaurant_id uuid;
  v_menu public.menus;
begin
  select id into v_restaurant_id from public.restaurants where owner_id = auth.uid() limit 1;
  if v_restaurant_id is null then raise exception 'No restaurant'; end if;

  select * into v_menu from public.menus where id = p_menu_id and restaurant_id = v_restaurant_id;
  if not found then raise exception 'Menu not found'; end if;

  update public.clover_integrations
  set delivery_menu_id = p_menu_id, updated_at = now()
  where restaurant_id = v_restaurant_id;

  if not found then raise exception 'Clover not connected'; end if;

  insert into public.clover_sync_queue (restaurant_id, job_type, payload)
  values (v_restaurant_id, 'full_push', jsonb_build_object('reason', 'delivery_menu_changed'));

  return public.get_clover_integration();
end;
$$;

create or replace function public.enqueue_clover_sync_job(
  p_restaurant_id uuid,
  p_job_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.clover_sync_queue (restaurant_id, job_type, payload)
  values (p_restaurant_id, p_job_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- ------------------------------------------------------------------
-- Sync enqueue triggers (delivery menu only)
-- ------------------------------------------------------------------

create or replace function public.clover_delivery_menu_id(p_menu_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select ci.delivery_menu_id
  from public.clover_integrations ci
  join public.menus m on m.restaurant_id = ci.restaurant_id
  where m.id = p_menu_id
    and ci.status = 'active'
    and ci.delivery_menu_id = p_menu_id
  limit 1;
$$;

create or replace function public.trg_enqueue_clover_item_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_menu_id uuid;
  v_restaurant_id uuid;
begin
  select s.menu_id, m.restaurant_id
  into v_menu_id, v_restaurant_id
  from public.menu_sections s
  join public.menus m on m.id = s.menu_id
  where s.id = coalesce(new.section_id, old.section_id);

  if v_menu_id is null then return coalesce(new, old); end if;
  if public.clover_delivery_menu_id(v_menu_id) is null then return coalesce(new, old); end if;

  if tg_op = 'DELETE' then
    perform public.enqueue_clover_sync_job(
      v_restaurant_id, 'item_delete',
      jsonb_build_object('item_id', old.id, 'section_id', old.section_id)
    );
  else
    perform public.enqueue_clover_sync_job(
      v_restaurant_id, 'item_upsert',
      jsonb_build_object('item_id', new.id, 'section_id', new.section_id)
    );
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.trg_enqueue_clover_section_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_menu_id uuid;
  v_restaurant_id uuid;
begin
  v_menu_id := coalesce(new.menu_id, old.menu_id);
  select restaurant_id into v_restaurant_id from public.menus where id = v_menu_id;
  if v_menu_id is null or v_restaurant_id is null then return coalesce(new, old); end if;
  if public.clover_delivery_menu_id(v_menu_id) is null then return coalesce(new, old); end if;

  if tg_op = 'DELETE' then
    perform public.enqueue_clover_sync_job(
      v_restaurant_id, 'section_delete',
      jsonb_build_object('section_id', old.id)
    );
  else
    perform public.enqueue_clover_sync_job(
      v_restaurant_id, 'section_upsert',
      jsonb_build_object('section_id', new.id)
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger clover_item_sync_enqueue
  after insert or update or delete on public.menu_items
  for each row execute function public.trg_enqueue_clover_item_sync();

create trigger clover_section_sync_enqueue
  after insert or update or delete on public.menu_sections
  for each row execute function public.trg_enqueue_clover_section_sync();

-- ------------------------------------------------------------------
-- Admin tenant clover status
-- ------------------------------------------------------------------

create or replace function public.admin_get_tenant_clover(p_restaurant_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select case when public.is_platform_admin() then (
    select jsonb_build_object(
      'status', ci.status,
      'clover_merchant_id', ci.clover_merchant_id,
      'delivery_menu_id', ci.delivery_menu_id,
      'last_full_sync_at', ci.last_full_sync_at,
      'last_push_at', ci.last_push_at,
      'last_error', ci.last_error
    )
    from public.clover_integrations ci
    where ci.restaurant_id = p_restaurant_id
  ) else null end;
$$;

-- ------------------------------------------------------------------
-- Cron: process clover sync queue + nightly reconcile
-- ------------------------------------------------------------------

update public.platform_settings
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{clover,cron_secret}',
  to_jsonb(coalesce(config->'clover'->>'cron_secret', encode(gen_random_bytes(24), 'hex'))),
  true
)
where id = 1
  and coalesce(config->'clover'->>'cron_secret', '') = '';

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'process-clover-sync') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'process-clover-sync';
  end if;
exception when undefined_table then
  null;
end;
$cron$;

select cron.schedule(
  'process-clover-sync',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://hhncgqdqnznnlcoswmrm.supabase.co/functions/v1/clover-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce(
        (select config->'clover'->>'cron_secret' from public.platform_settings where id = 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'clover-nightly-reconcile') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'clover-nightly-reconcile';
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
  where ci.status = 'active' and ci.delivery_menu_id is not null;
  $$
);

grant execute on function public.admin_get_clover_settings() to authenticated;
grant execute on function public.admin_update_clover_settings(jsonb) to authenticated;
grant execute on function public.service_clover_config() to service_role;
grant execute on function public.get_clover_feature_status() to anon, authenticated;
grant execute on function public.get_clover_integration() to authenticated;
grant execute on function public.set_clover_delivery_menu(uuid) to authenticated;
grant execute on function public.enqueue_clover_sync_job(uuid, text, jsonb) to service_role;
grant execute on function public.admin_get_tenant_clover(uuid) to authenticated;
grant execute on function public.clover_oauth_redirect_uri() to authenticated;
