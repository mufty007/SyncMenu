-- Fix pg_cron auth: read secret from platform_settings (hosted Supabase cannot SET DATABASE params).

update public.platform_settings
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{email,cron_secret}',
  to_jsonb(coalesce(config->'email'->>'cron_secret', '')),
  true
)
where id = 1
  and coalesce(config->'email'->>'cron_secret', '') = '';

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
