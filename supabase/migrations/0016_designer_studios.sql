-- SyncMenu 0016 — designer studios, restaurant memberships, partner plans.
-- Replaces the 1:1 owner_id access model with role-based memberships.

-- ------------------------------------------------------------------
-- Schema
-- ------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'restaurant'
    check (account_type in ('restaurant', 'designer')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create table public.studios (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.studios enable row level security;

create table public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'designer', 'operator')),
  studio_id uuid references public.studios(id) on delete set null,
  invited_email text,
  invite_token text unique,
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  invited_by uuid references auth.users(id)
);

create unique index restaurant_members_user_idx
  on public.restaurant_members (restaurant_id, user_id)
  where user_id is not null;

create unique index restaurant_members_one_owner
  on public.restaurant_members (restaurant_id)
  where role = 'owner' and accepted_at is not null;

create unique index restaurant_members_one_designer
  on public.restaurant_members (restaurant_id)
  where role = 'designer' and accepted_at is not null;

create unique index restaurant_members_one_operator
  on public.restaurant_members (restaurant_id)
  where role = 'operator' and accepted_at is not null;

create unique index restaurant_members_operator_user
  on public.restaurant_members (user_id)
  where accepted_at is not null and role in ('owner', 'operator');

create index restaurant_members_user_id_idx on public.restaurant_members (user_id);
create index restaurant_members_restaurant_idx on public.restaurant_members (restaurant_id);

alter table public.restaurant_members enable row level security;

create table public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  direction text not null check (direction in ('to_restaurant', 'to_studio')),
  requested_by uuid not null references auth.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index account_transfers_one_pending
  on public.account_transfers (restaurant_id)
  where status = 'pending';

alter table public.account_transfers enable row level security;

alter table public.restaurants
  add column if not exists managed_by_studio_id uuid references public.studios(id) on delete set null;

alter table public.restaurants
  add column if not exists created_by_studio_id uuid references public.studios(id) on delete set null;

alter table public.restaurants
  alter column owner_id drop not null;

alter table public.restaurants
  drop constraint if exists restaurants_owner_id_fkey;

alter table public.restaurants
  add constraint restaurants_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

drop index if exists public.restaurants_owner_idx;

create index restaurants_managed_studio_idx on public.restaurants (managed_by_studio_id);

-- ------------------------------------------------------------------
-- Backfill
-- ------------------------------------------------------------------

insert into public.profiles (user_id, account_type)
select u.id, 'restaurant'
from auth.users u
on conflict (user_id) do nothing;

insert into public.restaurant_members (restaurant_id, user_id, role, accepted_at)
select r.id, r.owner_id, 'owner', r.created_at
from public.restaurants r
where r.owner_id is not null
on conflict do nothing;

-- ------------------------------------------------------------------
-- New users get a profile
-- ------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_type text;
begin
  -- Seed once from signup payload. RLS always reads profiles, never user_metadata.
  v_type := case
    when new.raw_user_meta_data->>'account_type' = 'designer' then 'designer'
    else 'restaurant'
  end;
  insert into public.email_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.profiles (user_id, account_type) values (new.id, v_type)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------------
-- Role helpers (DEFINER + auth.uid() filter — avoids RLS recursion)
-- ------------------------------------------------------------------

create or replace function public.user_account_type()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select account_type
  from public.profiles
  where user_id = (select auth.uid())
$$;

create or replace function public.user_is_accepted_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members
    where restaurant_id = p_restaurant_id
      and user_id = (select auth.uid())
      and accepted_at is not null
  )
$$;

create or replace function public.user_restaurant_role(p_restaurant_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.restaurant_members
  where restaurant_id = p_restaurant_id
    and user_id = (select auth.uid())
    and accepted_at is not null
  limit 1
$$;

create or replace function public.user_can_design(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_restaurant_role(p_restaurant_id) in ('owner', 'designer')
$$;

create or replace function public.current_user_restaurant_id(p_restaurant_id uuid default null)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  if p_restaurant_id is not null then
    if public.user_restaurant_role(p_restaurant_id) is null then
      return null;
    end if;
    return p_restaurant_id;
  end if;

  select count(distinct restaurant_id) into v_count
  from public.restaurant_members
  where user_id = (select auth.uid()) and accepted_at is not null;

  if v_count = 1 then
    select restaurant_id into v_id
    from public.restaurant_members
    where user_id = (select auth.uid()) and accepted_at is not null
    limit 1;
    return v_id;
  end if;

  return null;
end;
$$;

create or replace function public.restaurant_billing_user_id(p_restaurant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select owner_id from public.restaurants where id = p_restaurant_id),
    (
      select user_id from public.restaurant_members
      where restaurant_id = p_restaurant_id
        and role in ('owner', 'operator')
        and accepted_at is not null
      limit 1
    ),
    (
      select user_id from public.restaurant_members
      where restaurant_id = p_restaurant_id
        and role = 'designer'
        and accepted_at is not null
      limit 1
    )
  )
$$;

revoke all on function public.user_account_type() from public;
revoke all on function public.user_is_accepted_member(uuid) from public;
revoke all on function public.user_restaurant_role(uuid) from public;
revoke all on function public.user_can_design(uuid) from public;
revoke all on function public.current_user_restaurant_id(uuid) from public;
revoke all on function public.restaurant_billing_user_id(uuid) from public;

grant execute on function public.user_account_type() to authenticated;
grant execute on function public.user_is_accepted_member(uuid) to authenticated;
grant execute on function public.user_restaurant_role(uuid) to authenticated;
grant execute on function public.user_can_design(uuid) to authenticated;
grant execute on function public.current_user_restaurant_id(uuid) to authenticated;

-- ------------------------------------------------------------------
-- Membership auto-create + unpaid cap + control-column guard
-- ------------------------------------------------------------------

create or replace function public.restaurants_enforce_studio_unpaid_cap()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_unpaid int;
begin
  if new.managed_by_studio_id is null then
    return new;
  end if;
  select count(*) into v_unpaid
  from public.restaurants r
  where r.managed_by_studio_id = new.managed_by_studio_id
    and r.id is distinct from new.id
    and not exists (
      select 1 from public.subscriptions s
      where s.restaurant_id = r.id and s.status in ('active', 'trialing')
    );
  if v_unpaid >= 3 then
    raise exception 'You can have at most 3 unpaid restaurants. Ask a client to subscribe first.';
  end if;
  return new;
end;
$$;

drop trigger if exists restaurants_studio_unpaid_cap on public.restaurants;
create trigger restaurants_studio_unpaid_cap
  before insert on public.restaurants
  for each row execute function public.restaurants_enforce_studio_unpaid_cap();

create or replace function public.restaurants_after_insert_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_studio_owner uuid;
begin
  if new.owner_id is not null then
    insert into public.restaurant_members (restaurant_id, user_id, role, accepted_at)
    values (new.id, new.owner_id, 'owner', now())
    on conflict do nothing;
  end if;
  if new.managed_by_studio_id is not null then
    select owner_user_id into v_studio_owner
    from public.studios where id = new.managed_by_studio_id;
    if v_studio_owner is not null then
      insert into public.restaurant_members (
        restaurant_id, user_id, role, studio_id, accepted_at
      )
      values (new.id, v_studio_owner, 'designer', new.managed_by_studio_id, now())
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists restaurants_after_insert_membership on public.restaurants;
create trigger restaurants_after_insert_membership
  after insert on public.restaurants
  for each row execute function public.restaurants_after_insert_membership();

create or replace function public.protect_restaurant_control_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_platform_admin() then
    return new;
  end if;
  if current_setting('syncmenu.allow_control_change', true) = '1' then
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.managed_by_studio_id is distinct from old.managed_by_studio_id
     or new.created_by_studio_id is distinct from old.created_by_studio_id then
    raise exception 'Use invite or transfer to change account control.';
  end if;
  return new;
end;
$$;

drop trigger if exists restaurants_protect_control on public.restaurants;
create trigger restaurants_protect_control
  before update on public.restaurants
  for each row execute function public.protect_restaurant_control_columns();

create or replace function public.enforce_operator_menu_design()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.user_restaurant_role(new.restaurant_id) = 'operator' then
    if new.template_id is distinct from old.template_id
       or new.template_config is distinct from old.template_config
       or new.orientation is distinct from old.orientation then
      raise exception 'Operators cannot change menu design.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists menus_operator_design_guard on public.menus;
create trigger menus_operator_design_guard
  before update on public.menus
  for each row execute function public.enforce_operator_menu_design();

-- ------------------------------------------------------------------
-- RLS rewrite
-- ------------------------------------------------------------------

drop policy if exists restaurants_owner on public.restaurants;
drop policy if exists menus_owner on public.menus;
drop policy if exists menu_sections_owner on public.menu_sections;
drop policy if exists menu_items_owner on public.menu_items;
drop policy if exists playlists_owner on public.playlists;
drop policy if exists playlist_slides_owner on public.playlist_slides;
drop policy if exists screens_owner on public.screens;
drop policy if exists media_assets_owner on public.media_assets;
drop policy if exists subscriptions_owner_read on public.subscriptions;
drop policy if exists clover_integrations_owner_read on public.clover_integrations;
drop policy if exists clover_sync_log_owner_read on public.clover_sync_log;
drop policy if exists subscription_addons_owner_read on public.subscription_addons;

-- profiles
create policy profiles_self_select on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- studios
create policy studios_owner_select on public.studios
  for select to authenticated
  using (owner_user_id = (select auth.uid()) or public.is_platform_admin());

create policy studios_owner_update on public.studios
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

-- restaurant_members
create policy restaurant_members_select on public.restaurant_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.user_is_accepted_member(restaurant_id)
    or public.is_platform_admin()
  );

-- account_transfers
create policy account_transfers_select on public.account_transfers
  for select to authenticated
  using (public.user_is_accepted_member(restaurant_id) or public.is_platform_admin());

-- restaurants
create policy restaurants_member_select on public.restaurants
  for select to authenticated
  using (public.user_is_accepted_member(id));

create policy restaurants_insert_self_serve on public.restaurants
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and managed_by_studio_id is null
    and coalesce(public.user_account_type(), 'restaurant') = 'restaurant'
  );

create policy restaurants_insert_studio on public.restaurants
  for insert to authenticated
  with check (
    owner_id is null
    and managed_by_studio_id in (
      select id from public.studios where owner_user_id = (select auth.uid())
    )
  );

create policy restaurants_update_designers on public.restaurants
  for update to authenticated
  using (public.user_can_design(id))
  with check (public.user_can_design(id));

create policy restaurants_delete_control on public.restaurants
  for delete to authenticated
  using (public.user_can_design(id));

-- menus
create policy menus_member_select on public.menus
  for select to authenticated
  using (public.user_is_accepted_member(restaurant_id));

create policy menus_design_insert on public.menus
  for insert to authenticated
  with check (public.user_can_design(restaurant_id));

create policy menus_member_update on public.menus
  for update to authenticated
  using (public.user_is_accepted_member(restaurant_id))
  with check (public.user_is_accepted_member(restaurant_id));

create policy menus_design_delete on public.menus
  for delete to authenticated
  using (public.user_can_design(restaurant_id));

-- sections
create policy menu_sections_member on public.menu_sections
  for all to authenticated
  using (
    menu_id in (
      select m.id from public.menus m
      where public.user_is_accepted_member(m.restaurant_id)
    )
  )
  with check (
    menu_id in (
      select m.id from public.menus m
      where public.user_is_accepted_member(m.restaurant_id)
    )
  );

-- items
create policy menu_items_member on public.menu_items
  for all to authenticated
  using (
    section_id in (
      select s.id from public.menu_sections s
      join public.menus m on m.id = s.menu_id
      where public.user_is_accepted_member(m.restaurant_id)
    )
  )
  with check (
    section_id in (
      select s.id from public.menu_sections s
      join public.menus m on m.id = s.menu_id
      where public.user_is_accepted_member(m.restaurant_id)
    )
  );

-- playlists / slides / media — design roles write; all members read (screen assignment)
create policy playlists_member_select on public.playlists
  for select to authenticated
  using (public.user_is_accepted_member(restaurant_id));

create policy playlists_design_write on public.playlists
  for insert to authenticated
  with check (public.user_can_design(restaurant_id));

create policy playlists_design_update on public.playlists
  for update to authenticated
  using (public.user_can_design(restaurant_id))
  with check (public.user_can_design(restaurant_id));

create policy playlists_design_delete on public.playlists
  for delete to authenticated
  using (public.user_can_design(restaurant_id));

create policy playlist_slides_member_select on public.playlist_slides
  for select to authenticated
  using (
    playlist_id in (
      select p.id from public.playlists p
      where public.user_is_accepted_member(p.restaurant_id)
    )
  );

create policy playlist_slides_design_write on public.playlist_slides
  for all to authenticated
  using (
    playlist_id in (
      select p.id from public.playlists p
      where public.user_can_design(p.restaurant_id)
    )
  )
  with check (
    playlist_id in (
      select p.id from public.playlists p
      where public.user_can_design(p.restaurant_id)
    )
  );

create policy media_assets_member_select on public.media_assets
  for select to authenticated
  using (public.user_is_accepted_member(restaurant_id));

create policy media_assets_design_write on public.media_assets
  for insert to authenticated
  with check (public.user_can_design(restaurant_id));

create policy media_assets_design_update on public.media_assets
  for update to authenticated
  using (public.user_can_design(restaurant_id))
  with check (public.user_can_design(restaurant_id));

create policy media_assets_design_delete on public.media_assets
  for delete to authenticated
  using (public.user_can_design(restaurant_id));

-- screens — all members
create policy screens_member on public.screens
  for all to authenticated
  using (public.user_is_accepted_member(restaurant_id))
  with check (public.user_is_accepted_member(restaurant_id));

create policy subscriptions_member_read on public.subscriptions
  for select to authenticated
  using (public.user_is_accepted_member(restaurant_id));

create policy subscription_addons_member_read on public.subscription_addons
  for select to authenticated
  using (public.user_is_accepted_member(restaurant_id));

create policy clover_integrations_member_read on public.clover_integrations
  for select to authenticated
  using (public.user_is_accepted_member(restaurant_id));

create policy clover_sync_log_member_read on public.clover_sync_log
  for select to authenticated
  using (public.user_is_accepted_member(restaurant_id));

-- storage
drop policy if exists "owners upload to their restaurant folder" on storage.objects;
drop policy if exists "owners delete from their restaurant folder" on storage.objects;

create policy "members upload to their restaurant folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and public.user_is_accepted_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members update their restaurant folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and public.user_is_accepted_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'menu-images'
    and public.user_is_accepted_member(((storage.foldername(name))[1])::uuid)
  );

create policy "members delete from their restaurant folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and public.user_is_accepted_member(((storage.foldername(name))[1])::uuid)
  );

grant select on public.profiles to authenticated;
grant select, update on public.studios to authenticated;
revoke insert, delete on public.studios from authenticated;
grant select on public.restaurant_members to authenticated;
grant select on public.account_transfers to authenticated;

-- ------------------------------------------------------------------
-- Partner plan limits in platform settings
-- ------------------------------------------------------------------

update public.platform_settings
set config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(config, '{plan_limits,partner}', '{"screens": 2, "menus": 5}'::jsonb),
              '{plan_limits,partner_growth}', '{"screens": 6, "menus": 10}'::jsonb
            ),
            '{plan_limits,partner_pro}', '{"screens": 12, "menus": 999}'::jsonb
          ),
          '{pricing,partner}', '{"monthly": 15, "annualMonthly": 12}'::jsonb
        ),
        '{pricing,partner_growth}', '{"monthly": 30, "annualMonthly": 25}'::jsonb
      ),
      '{pricing,partner_pro}', '{"monthly": 99, "annualMonthly": 82}'::jsonb
    ),
    '{plan_limits,trial}', coalesce(config->'plan_limits'->'trial', '{"screens": 5, "menus": 10}'::jsonb)
  ),
  '{pricing,starter}', coalesce(config->'pricing'->'starter', '{"monthly": 15, "annualMonthly": 12}'::jsonb)
)
where id = 1;

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
      when p_plan = 'partner' and p_field = 'screens' then 2
      when p_plan = 'partner' and p_field = 'menus' then 5
      when p_plan = 'partner_growth' and p_field = 'screens' then 6
      when p_plan = 'partner_growth' and p_field = 'menus' then 10
      when p_plan = 'partner_pro' and p_field = 'screens' then 12
      when p_plan = 'partner_pro' and p_field = 'menus' then 999
      when p_plan = 'trial' and p_field = 'screens' then 5
      when p_plan = 'trial' and p_field = 'menus' then 10
      else 5
    end
  );
$$;

create or replace function public.admin_set_tenant_plan(
  p_restaurant_id uuid,
  p_plan_id text,
  p_status text default 'active'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if p_plan_id not in ('starter', 'growth', 'pro', 'partner', 'partner_growth', 'partner_pro') then
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

-- ------------------------------------------------------------------
-- Studio / invite / transfer RPCs
-- ------------------------------------------------------------------

create or replace function public.create_studio(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_studio public.studios;
  v_name text := nullif(trim(p_name), '');
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Studio name is required.';
  end if;
  if exists (
    select 1 from public.restaurant_members
    where user_id = auth.uid()
      and accepted_at is not null
      and role in ('owner', 'operator')
  ) then
    raise exception 'Restaurant accounts cannot become a studio. Use a separate email.';
  end if;

  insert into public.profiles (user_id, account_type)
  values (auth.uid(), 'designer')
  on conflict (user_id) do update set account_type = 'designer';

  insert into public.studios (owner_user_id, name)
  values (auth.uid(), v_name)
  on conflict (owner_user_id) do update set name = excluded.name
  returning * into v_studio;

  return jsonb_build_object('id', v_studio.id, 'name', v_studio.name);
end;
$$;

create or replace function public.studio_create_restaurant(
  p_name text,
  p_currency text default 'USD',
  p_brand_color text default '#FF6B2C'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_studio uuid;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into v_studio from public.studios where owner_user_id = auth.uid();
  if v_studio is null then raise exception 'Create a studio first.'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Restaurant name is required.'; end if;

  insert into public.restaurants (
    owner_id, name, currency, brand_color, managed_by_studio_id, created_by_studio_id
  )
  values (
    null,
    trim(p_name),
    coalesce(nullif(trim(p_currency), ''), 'USD'),
    coalesce(nullif(trim(p_brand_color), ''), '#FF6B2C'),
    v_studio,
    v_studio
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.invite_restaurant_member(
  p_restaurant_id uuid,
  p_email text,
  p_role text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_token text := encode(gen_random_bytes(24), 'hex');
  v_id uuid;
  v_existing uuid;
  v_my_role text;
  v_studio uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_role not in ('operator', 'designer') then
    raise exception 'Role must be operator or designer.';
  end if;
  if v_email is null or v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'A valid email is required.';
  end if;

  v_my_role := public.user_restaurant_role(p_restaurant_id);
  if p_role = 'operator' and v_my_role is distinct from 'designer' then
    raise exception 'Only the designer can invite the restaurant.';
  end if;
  if p_role = 'designer' and v_my_role is distinct from 'owner' then
    raise exception 'Only the restaurant owner can invite a designer.';
  end if;

  if exists (
    select 1 from public.restaurant_members
    where restaurant_id = p_restaurant_id
      and role = p_role
      and accepted_at is not null
  ) then
    raise exception 'This restaurant already has a %.', p_role;
  end if;

  select id into v_existing from auth.users where lower(email) = v_email;
  if p_role = 'operator' and v_existing is not null then
    if exists (select 1 from public.profiles where user_id = v_existing and account_type = 'designer')
       or exists (select 1 from public.studios where owner_user_id = v_existing) then
      raise exception 'That email belongs to a designer account.';
    end if;
  end if;
  if p_role = 'designer' and v_existing is not null then
    if exists (
      select 1 from public.restaurant_members
      where user_id = v_existing and accepted_at is not null and role in ('owner', 'operator')
    ) then
      raise exception 'That email belongs to a restaurant account.';
    end if;
  end if;

  delete from public.restaurant_members
  where restaurant_id = p_restaurant_id
    and role = p_role
    and accepted_at is null;

  if p_role = 'designer' then
    select id into v_studio from public.studios where owner_user_id = v_existing;
  else
    select managed_by_studio_id into v_studio
    from public.restaurants where id = p_restaurant_id;
  end if;

  insert into public.restaurant_members (
    restaurant_id, role, invited_email, invite_token, invite_expires_at, invited_by, studio_id
  )
  values (
    p_restaurant_id, p_role, v_email, v_token, now() + interval '14 days', auth.uid(), v_studio
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'email', v_email,
    'role', p_role,
    'token', v_token
  );
end;
$$;

create or replace function public.get_invite_preview(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_row public.restaurant_members;
  v_name text;
begin
  select * into v_row
  from public.restaurant_members
  where invite_token = p_token
    and accepted_at is null
    and invite_expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Invite is invalid or has expired.');
  end if;
  select name into v_name from public.restaurants where id = v_row.restaurant_id;
  return jsonb_build_object(
    'ok', true,
    'role', v_row.role,
    'email', v_row.invited_email,
    'restaurant_name', v_name
  );
end;
$$;

create or replace function public.accept_invite(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.restaurant_members;
  v_account text;
  v_studio uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select * into v_row
  from public.restaurant_members
  where invite_token = p_token
    and accepted_at is null
    and invite_expires_at > now()
  for update;
  if not found then raise exception 'Invite is invalid or has expired.'; end if;

  select account_type into v_account from public.profiles where user_id = auth.uid();

  if v_row.role = 'operator' then
    if v_account = 'designer' or exists (select 1 from public.studios where owner_user_id = auth.uid()) then
      raise exception 'Designer accounts cannot accept a restaurant invite.';
    end if;
    if exists (
      select 1 from public.restaurant_members
      where user_id = auth.uid()
        and accepted_at is not null
        and role in ('owner', 'operator')
    ) then
      raise exception 'This email already belongs to another restaurant.';
    end if;
    perform set_config('syncmenu.allow_control_change', '1', true);
    update public.restaurant_members
    set user_id = auth.uid(), accepted_at = now(), invite_token = null
    where id = v_row.id;
    update public.restaurants set owner_id = auth.uid() where id = v_row.restaurant_id;
  else
    if v_account is distinct from 'designer' then
      raise exception 'Sign up as a designer to accept this invite.';
    end if;
    select id into v_studio from public.studios where owner_user_id = auth.uid();
    if v_studio is null then raise exception 'Create your studio first.'; end if;

    perform set_config('syncmenu.allow_control_change', '1', true);
    update public.restaurant_members
    set user_id = auth.uid(), accepted_at = now(), invite_token = null, studio_id = v_studio
    where id = v_row.id;

    -- Owner stays owner until a confirmed transfer. Designer is attached only.
    update public.restaurants
    set managed_by_studio_id = v_studio,
        created_by_studio_id = coalesce(created_by_studio_id, v_studio)
    where id = v_row.restaurant_id;
  end if;

  return jsonb_build_object('ok', true, 'restaurant_id', v_row.restaurant_id, 'role', v_row.role);
end;
$$;

create or replace function public.request_account_transfer(
  p_restaurant_id uuid,
  p_direction text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_id uuid;
begin
  if p_direction not in ('to_restaurant', 'to_studio') then
    raise exception 'Invalid transfer direction.';
  end if;
  v_role := public.user_restaurant_role(p_restaurant_id);
  if v_role is null then raise exception 'Not a member of this restaurant.'; end if;

  if p_direction = 'to_restaurant' then
    if v_role not in ('designer', 'operator', 'owner') then
      raise exception 'Not allowed.';
    end if;
    if not exists (
      select 1 from public.restaurant_members
      where restaurant_id = p_restaurant_id and role = 'designer' and accepted_at is not null
    ) then
      raise exception 'No designer is linked to this restaurant.';
    end if;
    if not exists (
      select 1 from public.restaurant_members
      where restaurant_id = p_restaurant_id
        and role in ('operator', 'owner')
        and accepted_at is not null
    ) then
      raise exception 'Invite the restaurant owner before transferring.';
    end if;
  else
    if v_role not in ('owner', 'operator', 'designer') then
      raise exception 'Not allowed.';
    end if;
    if not exists (
      select 1 from public.restaurant_members
      where restaurant_id = p_restaurant_id and role = 'designer' and accepted_at is not null
    ) then
      raise exception 'Invite a designer first.';
    end if;
  end if;

  delete from public.account_transfers
  where restaurant_id = p_restaurant_id and status = 'pending';

  insert into public.account_transfers (restaurant_id, direction, requested_by)
  values (p_restaurant_id, p_direction, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'direction', p_direction, 'status', 'pending');
end;
$$;

create or replace function public.cancel_account_transfer(p_restaurant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.user_restaurant_role(p_restaurant_id) is null then
    raise exception 'Not a member of this restaurant.';
  end if;
  update public.account_transfers
  set status = 'cancelled', resolved_at = now()
  where restaurant_id = p_restaurant_id and status = 'pending';
end;
$$;

create or replace function public.confirm_account_transfer(p_restaurant_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tx public.account_transfers;
  v_role text;
  v_shop uuid;
  v_studio uuid;
begin
  v_role := public.user_restaurant_role(p_restaurant_id);
  if v_role is null then raise exception 'Not a member of this restaurant.'; end if;

  select * into v_tx
  from public.account_transfers
  where restaurant_id = p_restaurant_id and status = 'pending'
  for update;
  if not found then raise exception 'No pending transfer.'; end if;
  if v_tx.requested_by = auth.uid() then
    raise exception 'The other party must confirm this transfer.';
  end if;

  perform set_config('syncmenu.allow_control_change', '1', true);

  if v_tx.direction = 'to_restaurant' then
    select user_id into v_shop
    from public.restaurant_members
    where restaurant_id = p_restaurant_id
      and role in ('operator', 'owner')
      and accepted_at is not null
    limit 1;
    if v_shop is null then raise exception 'No restaurant user to transfer to.'; end if;

    delete from public.restaurant_members
    where restaurant_id = p_restaurant_id and role = 'designer';

    update public.restaurant_members
    set role = 'owner'
    where restaurant_id = p_restaurant_id
      and user_id = v_shop
      and accepted_at is not null;

    update public.restaurants
    set managed_by_studio_id = null, owner_id = v_shop
    where id = p_restaurant_id;
  else
    select studio_id into v_studio
    from public.restaurant_members
    where restaurant_id = p_restaurant_id
      and role = 'designer'
      and accepted_at is not null
    limit 1;
    if v_studio is null then
      select coalesce(managed_by_studio_id, created_by_studio_id) into v_studio
      from public.restaurants where id = p_restaurant_id;
    end if;
    if v_studio is null then raise exception 'No studio to transfer to.'; end if;

    update public.restaurant_members
    set role = 'operator'
    where restaurant_id = p_restaurant_id
      and role = 'owner'
      and accepted_at is not null;

    update public.restaurants
    set managed_by_studio_id = v_studio
    where id = p_restaurant_id;
  end if;

  update public.account_transfers
  set status = 'accepted', resolved_at = now()
  where id = v_tx.id;

  return jsonb_build_object('ok', true, 'direction', v_tx.direction);
end;
$$;

-- ------------------------------------------------------------------
-- Pairing: optional restaurant id for multi-restaurant designers
-- ------------------------------------------------------------------

drop function if exists public.claim_pairing_session(text, text, text);

create function public.claim_pairing_session(
  p_code text,
  p_name text,
  p_orientation text default 'landscape',
  p_restaurant_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_restaurant uuid;
  v_session public.pairing_sessions;
  v_screen public.screens;
  v_limits jsonb;
  v_screen_limit int;
  v_screen_count int;
begin
  v_restaurant := public.current_user_restaurant_id(p_restaurant_id);
  if v_restaurant is null then
    raise exception 'No restaurant found for this account. Open the restaurant in your dashboard first.';
  end if;

  if exists (select 1 from public.restaurants where id = v_restaurant and status = 'suspended') then
    raise exception 'Account suspended — contact SyncMenu support.';
  end if;

  if not public.restaurant_has_player_access(v_restaurant) then
    raise exception 'Trial ended — subscribe to add screens.';
  end if;

  v_limits := public.restaurant_plan_limits(v_restaurant);
  v_screen_limit := (v_limits->>'screens')::int;
  select count(*) into v_screen_count from public.screens where restaurant_id = v_restaurant;

  if v_screen_count >= v_screen_limit then
    raise exception 'Screen limit reached: your plan includes up to % screens.', v_screen_limit;
  end if;

  select * into v_session from public.pairing_sessions
    where code = upper(trim(p_code)) and status = 'pending' and expires_at > now()
    for update;
  if not found then
    raise exception 'Pairing code is invalid or has expired. Reload the TV player and try again.';
  end if;

  insert into public.screens (restaurant_id, name, orientation)
    values (v_restaurant, coalesce(nullif(trim(p_name), ''), 'New screen'),
            case when p_orientation = 'portrait' then 'portrait' else 'landscape' end)
    returning * into v_screen;
  update public.pairing_sessions
    set status = 'claimed', screen_id = v_screen.id where id = v_session.id;
  return jsonb_build_object('screen_id', v_screen.id, 'name', v_screen.name);
end;
$$;

grant execute on function public.claim_pairing_session(text, text, text, uuid) to authenticated;

-- ------------------------------------------------------------------
-- Clover RPCs: optional restaurant id
-- ------------------------------------------------------------------

drop function if exists public.get_clover_integration();

create function public.get_clover_integration(p_restaurant_id uuid default null)
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
  v_restaurant_id := public.current_user_restaurant_id(p_restaurant_id);
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

drop function if exists public.set_clover_delivery_menu(uuid);

create function public.set_clover_delivery_menu(
  p_menu_id uuid,
  p_restaurant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_menu public.menus;
begin
  v_restaurant_id := public.current_user_restaurant_id(p_restaurant_id);
  if v_restaurant_id is null then raise exception 'No restaurant'; end if;
  if not public.user_can_design(v_restaurant_id) then
    raise exception 'Only the designer or owner can change the delivery menu.';
  end if;
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

  return public.get_clover_integration(v_restaurant_id);
end;
$$;

-- ------------------------------------------------------------------
-- Admin tenant list: left join owner (partner restaurants may have none yet)
-- ------------------------------------------------------------------

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
  left join auth.users u on u.id = r.owner_id
  left join public.studios st on st.id = r.managed_by_studio_id
  left join public.subscriptions s on s.restaurant_id = r.id
  where p_search is null or p_search = '' or (
    r.name ilike '%' || p_search || '%'
    or coalesce(u.email, '') ilike '%' || p_search || '%'
    or coalesce(st.name, '') ilike '%' || p_search || '%'
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
      st.name as studio_name,
      r.managed_by_studio_id,
      s.plan_id,
      s.status as subscription_status,
      (select count(*) from public.screens sc where sc.restaurant_id = r.id) as screen_count,
      (select count(*) from public.menus m where m.restaurant_id = r.id) as menu_count
    from public.restaurants r
    left join auth.users u on u.id = r.owner_id
    left join public.studios st on st.id = r.managed_by_studio_id
    left join public.subscriptions s on s.restaurant_id = r.id
    where p_search is null or p_search = '' or (
      r.name ilike '%' || p_search || '%'
      or coalesce(u.email, '') ilike '%' || p_search || '%'
      or coalesce(st.name, '') ilike '%' || p_search || '%'
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
    'managed_by_studio_id', r.managed_by_studio_id,
    'studio_name', st.name,
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
  left join auth.users u on u.id = r.owner_id
  left join public.studios st on st.id = r.managed_by_studio_id
  where r.id = p_id;

  if v_row is null then raise exception 'Restaurant not found'; end if;
  return v_row;
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
    left join auth.users u on u.id = r.owner_id
    order by s.updated_at desc nulls last
  ) t
  where public.is_platform_admin();
$$;

create or replace function public.admin_email_stats()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total_owners', (select count(*) from public.restaurants),
    'opted_in', (
      select count(distinct public.restaurant_billing_user_id(r.id))
      from public.restaurants r
      left join public.email_preferences ep
        on ep.user_id = public.restaurant_billing_user_id(r.id)
      where r.status = 'active'
        and public.restaurant_billing_user_id(r.id) is not null
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
    from public.restaurants r
    join auth.users u on u.id = public.restaurant_billing_user_id(r.id)
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
    from public.restaurants r
    join auth.users u on u.id = public.restaurant_billing_user_id(r.id)
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

-- ------------------------------------------------------------------
-- Grants
-- ------------------------------------------------------------------

grant execute on function public.create_studio(text) to authenticated;
grant execute on function public.studio_create_restaurant(text, text, text) to authenticated;
grant execute on function public.invite_restaurant_member(uuid, text, text) to authenticated;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.request_account_transfer(uuid, text) to authenticated;
grant execute on function public.cancel_account_transfer(uuid) to authenticated;
grant execute on function public.confirm_account_transfer(uuid) to authenticated;
grant execute on function public.get_clover_integration(uuid) to authenticated;
grant execute on function public.set_clover_delivery_menu(uuid, uuid) to authenticated;

grant all on table public.profiles to postgres, service_role;
grant all on table public.studios to postgres, service_role;
grant all on table public.restaurant_members to postgres, service_role;
grant all on table public.account_transfers to postgres, service_role;
