-- SyncMenu migration 0010 — email automations, dedup log, queue, cron hook.
-- Run after 0009_email_admin.sql.

-- Dedup sent automations per restaurant + key
create table if not exists public.email_automation_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  automation_key text not null,
  sent_at timestamptz not null default now(),
  unique (restaurant_id, automation_key)
);

create index if not exists email_automation_log_key_idx on public.email_automation_log (automation_key);

-- Queue for async automations (e.g. account suspended)
create table if not exists public.email_automation_queue (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  automation_key text not null,
  vars jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists email_automation_queue_pending_idx
  on public.email_automation_queue (created_at)
  where processed_at is null;

alter table public.email_automation_log enable row level security;
alter table public.email_automation_queue enable row level security;

-- Seed default automation templates
update public.platform_settings
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{email,automations}',
  coalesce(config->'email'->'automations', '{}'::jsonb) || '{
    "welcome": {
      "enabled": true,
      "subject": "Welcome to SyncMenu — let''s get your menu live",
      "html": "<div style=\"font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933\"><h1 style=\"color:#FF6B2C;font-size:24px\">Welcome to SyncMenu</h1><p>Hi — your digital menu board is ready to set up. Here''s how to go live in minutes:</p><ol><li>Finish your restaurant profile</li><li>Create your first menu</li><li>Open <a href=\"{{origin}}/play\">SyncMenu Play</a> on your TV and pair it</li></ol><p><a href=\"{{origin}}/app/menus\" style=\"background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block\">Open your dashboard</a></p><p style=\"color:#52606D;font-size:13px;margin-top:32px\">Questions? Reply to this email — we''re here to help.</p></div>"
    },
    "trial_ending": {
      "enabled": true,
      "days_before": 3,
      "subject": "Your SyncMenu trial ends in {{trial_days_left}} days",
      "html": "<div style=\"font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933\"><h1 style=\"color:#FF6B2C;font-size:22px\">Your trial is ending soon</h1><p><strong>{{restaurant_name}}</strong> has <strong>{{trial_days_left}} day(s)</strong> left on your free trial.</p><p>Subscribe now to keep your screens live — every feature stays on every plan.</p><p><a href=\"{{billing_url}}\" style=\"background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block\">Choose a plan</a></p><p style=\"color:#52606D;font-size:13px;margin-top:24px\">Need help? Just reply to this email.</p></div>"
    },
    "trial_expired": {
      "enabled": true,
      "subject": "Your SyncMenu trial has ended",
      "html": "<div style=\"font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933\"><h1 style=\"color:#FF6B2C;font-size:22px\">Your trial has ended</h1><p>Your menus for <strong>{{restaurant_name}}</strong> are paused until you subscribe.</p><p>Pick a plan and your screens go live again in seconds.</p><p><a href=\"{{billing_url}}\" style=\"background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block\">Subscribe now</a></p></div>"
    },
    "subscription_confirmed": {
      "enabled": true,
      "subject": "You''re subscribed to SyncMenu {{plan_name}}",
      "html": "<div style=\"font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933\"><h1 style=\"color:#FF6B2C;font-size:22px\">You''re all set!</h1><p>Thanks — <strong>{{restaurant_name}}</strong> is now on the <strong>{{plan_name}}</strong> plan.</p><p>Your screens stay live. Manage billing anytime from your dashboard.</p><p><a href=\"{{billing_url}}\" style=\"background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block\">Manage billing</a></p></div>"
    },
    "payment_failed": {
      "enabled": true,
      "subject": "Action needed — payment failed for SyncMenu",
      "html": "<div style=\"font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933\"><h1 style=\"color:#E5484D;font-size:22px\">We couldn''t process your payment</h1><p>Your subscription for <strong>{{restaurant_name}}</strong> needs attention.</p><p>Update your card to keep your menu boards live.</p><p><a href=\"{{billing_url}}\" style=\"background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block\">Update payment method</a></p></div>"
    },
    "account_suspended": {
      "enabled": true,
      "subject": "Your SyncMenu account has been suspended",
      "html": "<div style=\"font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933\"><h1 style=\"color:#E5484D;font-size:22px\">Account suspended</h1><p>Your SyncMenu account for <strong>{{restaurant_name}}</strong> has been suspended.</p><p>Your screens will not display until the account is restored. Contact support if you have questions.</p><p style=\"color:#52606D;font-size:13px;margin-top:24px\">Reply to this email for help.</p></div>"
    }
  }'::jsonb,
  true
)
where id = 1;

-- Extend admin_get_email_settings with smtp_ready + test status
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
    'reply_to', coalesce(v_email->>'reply_to', public.platform_settings_config()->>'support_email', ''),
    'smtp_ready', v_key is not null and v_key <> '' and coalesce(v_email->>'smtp_sender', '') <> '',
    'last_test_at', v_email->>'last_test_at',
    'last_test_ok', coalesce((v_email->>'last_test_ok')::boolean, false)
  );
end;
$$;

create or replace function public.admin_record_email_test(p_ok boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  v_email := coalesce(public.platform_settings_config()->'email', '{}'::jsonb)
    || jsonb_build_object(
      'last_test_at', now()::text,
      'last_test_ok', p_ok
    );

  update public.platform_settings
  set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('email', v_email),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  return public.admin_get_email_settings();
end;
$$;

create or replace function public.admin_get_email_automations()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_automations jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  v_automations := coalesce(public.platform_settings_config()->'email'->'automations', '{}'::jsonb);
  return v_automations;
end;
$$;

create or replace function public.admin_update_email_automation(p_key text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email jsonb;
  v_automations jsonb;
  v_current jsonb;
  v_merged jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if p_key is null or p_key = '' then raise exception 'Automation key required'; end if;

  v_email := coalesce(public.platform_settings_config()->'email', '{}'::jsonb);
  v_automations := coalesce(v_email->'automations', '{}'::jsonb);
  v_current := coalesce(v_automations->p_key, '{}'::jsonb);
  v_merged := v_current || p_payload;

  v_automations := v_automations || jsonb_build_object(p_key, v_merged);
  v_email := v_email || jsonb_build_object('automations', v_automations);

  update public.platform_settings
  set config = coalesce(config, '{}'::jsonb) || jsonb_build_object('email', v_email),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  perform public.log_admin_action('update_email_automation', 'platform_settings', null,
    jsonb_build_object('key', p_key, 'enabled', v_merged->>'enabled'));

  return v_merged;
end;
$$;

-- Internal: queue an automation for edge function processing
create or replace function public.service_queue_automation(
  p_restaurant_id uuid,
  p_key text,
  p_vars jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into public.email_automation_queue (restaurant_id, automation_key, vars)
  values (p_restaurant_id, p_key, coalesce(p_vars, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- Queue account_suspended when admin suspends a tenant
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

  if p_suspend then
    perform public.service_queue_automation(p_id, 'account_suspended', '{}'::jsonb);
  end if;

  perform public.log_admin_action(
    case when p_suspend then 'suspend_tenant' else 'unsuspend_tenant' end,
    'restaurant', p_id,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

grant execute on function public.admin_record_email_test(boolean) to authenticated;
grant execute on function public.admin_get_email_automations() to authenticated;
grant execute on function public.admin_update_email_automation(text, jsonb) to authenticated;
grant execute on function public.service_queue_automation(uuid, text, jsonb) to service_role;

-- pg_cron + pg_net: daily trial automations + queue drain
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'process-email-automations') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'process-email-automations';
  end if;
exception when undefined_table then
  null;
end;
$cron$;

select cron.schedule(
  'process-email-automations',
  '0 14 * * *',
  $$
  select net.http_post(
    url := 'https://hhncgqdqnznnlcoswmrm.supabase.co/functions/v1/process-email-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', coalesce(
        (select config->'email'->>'cron_secret' from public.platform_settings where id = 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Set platform_settings.config.email.cron_secret to match AUTOMATION_CRON_SECRET after deploy.
