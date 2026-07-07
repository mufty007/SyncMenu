-- SyncMenu migration 0007 — updated plan screen limits (Starter 1, Growth 5, Pro 10).
-- Keep in sync with src/lib/types.ts PLAN_LIMITS_BY_PLAN.

create or replace function public.restaurant_plan_limits(p_restaurant_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select jsonb_build_object(
        'screens',
        case s.plan_id
          when 'starter' then 1
          when 'growth' then 5
          when 'pro' then 10
          else 5
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
    jsonb_build_object('screens', 5, 'menus', 10)
  );
$$;
