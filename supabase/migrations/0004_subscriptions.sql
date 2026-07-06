-- SyncMenu migration 0004 — Stripe subscription state.
-- Run in the Supabase SQL editor after 0003.

create table public.subscriptions (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  plan_id text,
  price_id text,
  status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Owners can read their subscription; all writes happen from the Stripe
-- webhook / checkout edge functions using the service-role key.
create policy subscriptions_owner_read on public.subscriptions
  for select using (
    restaurant_id in (select id from public.restaurants where owner_id = auth.uid())
  );
