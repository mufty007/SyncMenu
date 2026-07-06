-- SyncMenu migration 0005 — platform admin schema, RLS, and admin RPCs.
-- Run after 0004_subscriptions.sql.

-- ------------------------------------------------------------------
-- Tenant lifecycle
-- ------------------------------------------------------------------

alter table public.restaurants
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended'));

alter table public.restaurants
  add column if not exists suspended_at timestamptz;

alter table public.restaurants
  add column if not exists suspended_reason text;

-- ------------------------------------------------------------------
-- Platform admins (max 3, enforced in admin_manage_admin)
-- ------------------------------------------------------------------

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.platform_admins enable row level security;

-- ------------------------------------------------------------------
-- Email preferences (marketing + unsubscribe)
-- ------------------------------------------------------------------

create table public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  marketing_opt_in boolean not null default true,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.email_preferences enable row level security;

create policy email_prefs_owner on public.email_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------
-- Email campaigns + audit log
-- ------------------------------------------------------------------

create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_html text not null,
  audience text not null check (audience in ('all', 'active', 'trial', 'subscribed', 'churned')),
  sent_by uuid references auth.users(id),
  sent_at timestamptz,
  recipient_count int,
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.email_campaigns enable row level security;

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

-- ------------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.log_admin_action(
  p_action text,
  p_target_type text default null,
  p_target_id uuid default null,
  p_metadata jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_metadata);
end;
$$;

-- New auth users get email preference row
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.email_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------
-- Admin RLS: read all tenants; admin-only tables
-- ------------------------------------------------------------------

create policy restaurants_admin_select on public.restaurants
  for select using (public.is_platform_admin());

create policy restaurants_admin_update on public.restaurants
  for update using (public.is_platform_admin());

create policy menus_admin_select on public.menus
  for select using (public.is_platform_admin());

create policy screens_admin_select on public.screens
  for select using (public.is_platform_admin());

create policy subscriptions_admin_select on public.subscriptions
  for select using (public.is_platform_admin());

create policy platform_admins_read on public.platform_admins
  for select using (user_id = auth.uid() or public.is_platform_admin());

create policy email_prefs_admin_select on public.email_preferences
  for select using (public.is_platform_admin());

create policy email_campaigns_admin on public.email_campaigns
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy admin_audit_admin on public.admin_audit_log
  for select using (public.is_platform_admin());

-- ------------------------------------------------------------------
-- Admin RPCs
-- ------------------------------------------------------------------

create or replace function public.admin_platform_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_trials int;
  v_subscribed int;
  v_signups_7d int;
  v_screens int;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  select count(*) into v_total from public.restaurants;
  select count(*) into v_trials from public.restaurants r
    where r.trial_ends_at > now()
      and not exists (
        select 1 from public.subscriptions s
        where s.restaurant_id = r.id and s.status in ('active', 'trialing')
      );
  select count(*) into v_subscribed from public.subscriptions where status in ('active', 'trialing');
  select count(*) into v_signups_7d from public.restaurants where created_at > now() - interval '7 days';
  select count(*) into v_screens from public.screens;

  return jsonb_build_object(
    'total_restaurants', v_total,
    'active_trials', v_trials,
    'subscribed', v_subscribed,
    'signups_7d', v_signups_7d,
    'total_screens', v_screens
  );
end;
$$;

create or replace function public.admin_list_tenants(
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
  v_total int;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  select count(*) into v_total
  from public.restaurants r
  join auth.users u on u.id = r.owner_id
  left join public.subscriptions s on s.restaurant_id = r.id
  where p_search is null or p_search = '' or (
    r.name ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%'
  );

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      r.id,
      r.name,
      r.status,
      r.trial_ends_at,
      r.created_at,
      u.email as owner_email,
      s.plan_id,
      s.status as subscription_status,
      (select count(*) from public.screens sc where sc.restaurant_id = r.id) as screen_count,
      (select count(*) from public.menus m where m.restaurant_id = r.id) as menu_count
    from public.restaurants r
    join auth.users u on u.id = r.owner_id
    left join public.subscriptions s on s.restaurant_id = r.id
    where p_search is null or p_search = '' or (
      r.name ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%'
    )
    order by r.created_at desc
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset)
  ) t;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

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
    'subscription', (
      select jsonb_build_object(
        'plan_id', s.plan_id,
        'status', s.status,
        'stripe_customer_id', s.stripe_customer_id,
        'current_period_end', s.current_period_end
      )
      from public.subscriptions s where s.restaurant_id = r.id
    ),
    'screen_count', (select count(*) from public.screens sc where sc.restaurant_id = r.id),
    'menu_count', (select count(*) from public.menus m where m.restaurant_id = r.id)
  ) into v_row
  from public.restaurants r
  join auth.users u on u.id = r.owner_id
  where r.id = p_id;

  if v_row is null then raise exception 'Restaurant not found'; end if;
  return v_row;
end;
$$;

create or replace function public.admin_suspend_tenant(
  p_id uuid,
  p_suspend boolean,
  p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  update public.restaurants set
    status = case when p_suspend then 'suspended' else 'active' end,
    suspended_at = case when p_suspend then now() else null end,
    suspended_reason = case when p_suspend then nullif(trim(p_reason), '') else null end
  where id = p_id;

  perform public.log_admin_action(
    case when p_suspend then 'suspend_tenant' else 'unsuspend_tenant' end,
    'restaurant', p_id,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

create or replace function public.admin_extend_trial(p_id uuid, p_days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if p_days < 1 or p_days > 365 then raise exception 'Days must be between 1 and 365'; end if;

  update public.restaurants
  set trial_ends_at = greatest(trial_ends_at, now()) + (p_days || ' days')::interval
  where id = p_id;

  perform public.log_admin_action('extend_trial', 'restaurant', p_id, jsonb_build_object('days', p_days));
end;
$$;

create or replace function public.admin_list_subscriptions()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select
      r.id as restaurant_id,
      r.name as restaurant_name,
      u.email as owner_email,
      s.plan_id,
      s.status,
      s.stripe_customer_id,
      s.current_period_end,
      s.updated_at
    from public.subscriptions s
    join public.restaurants r on r.id = s.restaurant_id
    join auth.users u on u.id = r.owner_id
    order by s.updated_at desc nulls last
  ) t
  where public.is_platform_admin();
$$;

create or replace function public.admin_list_admins()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select user_id, email, created_at
    from public.platform_admins
    order by created_at
  ) t
  where public.is_platform_admin();
$$;

create or replace function public.admin_manage_admin(p_action text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_count int;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'No user with that email'; end if;

  if p_action = 'add' then
    select count(*) into v_count from public.platform_admins;
    if v_count >= 3 then raise exception 'Maximum of 3 platform admins'; end if;
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

create or replace function public.admin_list_audit(p_limit int default 100)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select a.id, a.action, a.target_type, a.target_id, a.metadata, a.created_at,
           pa.email as admin_email
    from public.admin_audit_log a
    join public.platform_admins pa on pa.user_id = a.admin_id
    order by a.created_at desc
    limit greatest(1, least(p_limit, 500))
  ) t
  where public.is_platform_admin();
$$;

create or replace function public.admin_export_emails()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select u.email, r.name as restaurant_name, ep.marketing_opt_in, ep.unsubscribed_at
    from auth.users u
    join public.restaurants r on r.owner_id = u.id
    left join public.email_preferences ep on ep.user_id = u.id
    where coalesce(ep.marketing_opt_in, true) and ep.unsubscribed_at is null
    order by u.email
  ) t
  where public.is_platform_admin();
$$;

create or replace function public.admin_save_campaign(
  p_id uuid,
  p_subject text,
  p_body_html text,
  p_audience text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  if p_id is null then
    insert into public.email_campaigns (subject, body_html, audience, sent_by)
    values (p_subject, p_body_html, p_audience, auth.uid())
    returning id into v_id;
  else
    update public.email_campaigns set
      subject = p_subject,
      body_html = p_body_html,
      audience = p_audience
    where id = p_id and status = 'draft'
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_list_campaigns()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select id, subject, audience, status, sent_at, recipient_count, created_at
    from public.email_campaigns
    order by created_at desc
  ) t
  where public.is_platform_admin();
$$;

create or replace function public.admin_get_campaign_recipients(p_audience text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return (
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    from (
      select u.id as user_id, u.email, r.name as restaurant_name
      from auth.users u
      join public.restaurants r on r.owner_id = u.id
      left join public.email_preferences ep on ep.user_id = u.id
      left join public.subscriptions s on s.restaurant_id = r.id
      where coalesce(ep.marketing_opt_in, true)
        and ep.unsubscribed_at is null
        and r.status = 'active'
        and (
          p_audience = 'all'
          or (p_audience = 'trial' and r.trial_ends_at > now()
              and coalesce(s.status, '') not in ('active', 'trialing'))
          or (p_audience = 'subscribed' and s.status in ('active', 'trialing'))
          or (p_audience = 'active' and (r.trial_ends_at > now() or s.status in ('active', 'trialing')))
          or (p_audience = 'churned' and r.trial_ends_at <= now()
              and coalesce(s.status, '') not in ('active', 'trialing'))
        )
      order by u.email
    ) t
  );
end;
$$;

-- Unsubscribe token: HMAC-style simple token stored as user_id + signature in app
create or replace function public.unsubscribe_marketing(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.email_preferences (user_id, marketing_opt_in, unsubscribed_at, updated_at)
  values (p_user_id, false, now(), now())
  on conflict (user_id) do update set
    marketing_opt_in = false,
    unsubscribed_at = now(),
    updated_at = now();
end;
$$;

-- Grants
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_platform_stats() to authenticated;
grant execute on function public.admin_list_tenants(text, int, int) to authenticated;
grant execute on function public.admin_get_tenant(uuid) to authenticated;
grant execute on function public.admin_suspend_tenant(uuid, boolean, text) to authenticated;
grant execute on function public.admin_extend_trial(uuid, int) to authenticated;
grant execute on function public.admin_list_subscriptions() to authenticated;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_manage_admin(text, text) to authenticated;
grant execute on function public.admin_list_audit(int) to authenticated;
grant execute on function public.admin_export_emails() to authenticated;
grant execute on function public.admin_save_campaign(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_campaigns() to authenticated;
grant execute on function public.admin_get_campaign_recipients(text) to authenticated;
grant execute on function public.unsubscribe_marketing(uuid) to anon, authenticated;
