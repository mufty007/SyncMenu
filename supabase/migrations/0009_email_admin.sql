-- SyncMenu migration 0009 — email admin settings, campaign detail, recipient stats.
-- Run after 0008_platform_settings.sql.

-- Seed email config defaults into platform_settings
update public.platform_settings
set config = config || jsonb_build_object(
  'email', jsonb_build_object(
    'smtp_sender', 'noreply@syncmenuapp.com',
    'site_origin', coalesce(config->>'site_url', 'https://syncmenuapp.com'),
    'welcome_subject', 'Welcome to SyncMenu — let''s get your menu live',
    'welcome_enabled', true
  )
)
where id = 1 and config->'email' is null;

-- Mask API key for admin UI (show last 4 chars only)
create or replace function public.mask_secret(p_value text)
returns text language sql immutable as $$
  select case
    when p_value is null or length(p_value) < 4 then null
    else '••••••••' || right(p_value, 4)
  end;
$$;

create or replace function public.admin_get_email_settings()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email jsonb;
  v_key text;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  v_email := coalesce(public.platform_settings_config()->'email', '{}'::jsonb);
  v_key := v_email->>'smtp_api_key';

  return jsonb_build_object(
    'smtp_api_key_masked', public.mask_secret(v_key),
    'smtp_api_key_set', v_key is not null and v_key <> '',
    'smtp_sender', coalesce(v_email->>'smtp_sender', ''),
    'site_origin', coalesce(v_email->>'site_origin', public.platform_settings_config()->>'site_url', ''),
    'unsubscribe_secret_set', coalesce(v_email->>'unsubscribe_secret', '') <> '',
    'welcome_subject', coalesce(v_email->>'welcome_subject', 'Welcome to SyncMenu — let''s get your menu live'),
    'welcome_html', v_email->>'welcome_html',
    'welcome_enabled', coalesce((v_email->>'welcome_enabled')::boolean, true),
    'reply_to', coalesce(v_email->>'reply_to', public.platform_settings_config()->>'support_email', '')
  );
end;
$$;

create or replace function public.admin_update_email_settings(p_email jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_current jsonb;
  v_merged jsonb;
  v_new_key text;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  v_current := coalesce(public.platform_settings_config()->'email', '{}'::jsonb);
  v_merged := v_current || p_email;

  v_new_key := p_email->>'smtp_api_key';
  if v_new_key is null or v_new_key = '' or v_new_key like '••••%' then
    v_merged := v_merged - 'smtp_api_key';
    if v_current ? 'smtp_api_key' then
      v_merged := v_merged || jsonb_build_object('smtp_api_key', v_current->>'smtp_api_key');
    end if;
  end if;

  if p_email ? 'unsubscribe_secret' then
    if nullif(p_email->>'unsubscribe_secret', '') is null then
      v_merged := v_merged - 'unsubscribe_secret';
      if v_current ? 'unsubscribe_secret' then
        v_merged := v_merged || jsonb_build_object('unsubscribe_secret', v_current->>'unsubscribe_secret');
      end if;
    end if;
  end if;

  update public.platform_settings
  set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('email', v_merged),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  perform public.log_admin_action('update_email_settings', 'platform_settings', null, jsonb_build_object(
    'smtp_sender', v_merged->>'smtp_sender',
    'site_origin', v_merged->>'site_origin'
  ));

  return public.admin_get_email_settings();
end;
$$;

create or replace function public.admin_get_campaign(p_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select row_to_json(c)::jsonb
  from public.email_campaigns c
  where c.id = p_id and public.is_platform_admin();
$$;

create or replace function public.admin_email_stats()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total_owners', (select count(*) from public.restaurants),
    'opted_in', (
      select count(distinct r.owner_id)
      from public.restaurants r
      left join public.email_preferences ep on ep.user_id = r.owner_id
      where r.status = 'active'
        and coalesce(ep.marketing_opt_in, true)
        and ep.unsubscribed_at is null
    ),
    'unsubscribed', (
      select count(*) from public.email_preferences where marketing_opt_in = false or unsubscribed_at is not null
    ),
    'campaigns_sent', (select count(*) from public.email_campaigns where status = 'sent'),
    'drafts', (select count(*) from public.email_campaigns where status = 'draft')
  )
  where public.is_platform_admin();
$$;

create or replace function public.admin_list_email_recipients(
  p_audience text default 'all',
  p_limit int default 100,
  p_offset int default 0
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_rows jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  select count(*) into v_total
  from (
    select u.id
    from auth.users u
    join public.restaurants r on r.owner_id = u.id
    left join public.email_preferences ep on ep.user_id = u.id
    left join public.subscriptions s on s.restaurant_id = r.id
    where (
      p_audience = 'all'
      or (p_audience = 'trial' and r.trial_ends_at > now()
          and coalesce(s.status, '') not in ('active', 'trialing'))
      or (p_audience = 'subscribed' and s.status in ('active', 'trialing'))
      or (p_audience = 'active' and (r.trial_ends_at > now() or s.status in ('active', 'trialing')))
      or (p_audience = 'churned' and r.trial_ends_at <= now()
          and coalesce(s.status, '') not in ('active', 'trialing'))
    )
  ) q;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      u.id as user_id,
      u.email,
      r.name as restaurant_name,
      r.status as restaurant_status,
      coalesce(ep.marketing_opt_in, true) as marketing_opt_in,
      ep.unsubscribed_at,
      s.plan_id,
      s.status as subscription_status
    from auth.users u
    join public.restaurants r on r.owner_id = u.id
    left join public.email_preferences ep on ep.user_id = u.id
    left join public.subscriptions s on s.restaurant_id = r.id
    where (
      p_audience = 'all'
      or (p_audience = 'trial' and r.trial_ends_at > now()
          and coalesce(s.status, '') not in ('active', 'trialing'))
      or (p_audience = 'subscribed' and s.status in ('active', 'trialing'))
      or (p_audience = 'active' and (r.trial_ends_at > now() or s.status in ('active', 'trialing')))
      or (p_audience = 'churned' and r.trial_ends_at <= now()
          and coalesce(s.status, '') not in ('active', 'trialing'))
    )
    order by u.email
    limit greatest(1, least(p_limit, 500))
    offset greatest(0, p_offset)
  ) t;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

-- Service role helper for edge functions (read full email secrets)
create or replace function public.service_email_config()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(public.platform_settings_config()->'email', '{}'::jsonb);
$$;

grant execute on function public.admin_get_email_settings() to authenticated;
grant execute on function public.admin_update_email_settings(jsonb) to authenticated;
grant execute on function public.admin_get_campaign(uuid) to authenticated;
grant execute on function public.admin_email_stats() to authenticated;
grant execute on function public.admin_list_email_recipients(text, int, int) to authenticated;
grant execute on function public.service_email_config() to service_role;
