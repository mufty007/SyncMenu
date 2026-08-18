-- SyncMenu 0017 — platform admin: designer studios list, stats, and management.

create or replace function public.admin_platform_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_trials int;
  v_subscribed int;
  v_signups_7d int;
  v_screens int;
  v_studios int;
  v_partner int;
  v_partner_paid int;
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
  select count(*) into v_studios from public.studios;
  select count(*) into v_partner from public.restaurants where managed_by_studio_id is not null;
  select count(*) into v_partner_paid
  from public.restaurants r
  join public.subscriptions s on s.restaurant_id = r.id
  where r.managed_by_studio_id is not null
    and s.status in ('active', 'trialing');

  return jsonb_build_object(
    'total_restaurants', v_total,
    'active_trials', v_trials,
    'subscribed', v_subscribed,
    'signups_7d', v_signups_7d,
    'total_screens', v_screens,
    'total_studios', v_studios,
    'partner_restaurants', v_partner,
    'partner_subscribed', v_partner_paid
  );
end;
$$;

create or replace function public.admin_list_studios(
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
  from public.studios st
  left join auth.users u on u.id = st.owner_user_id
  where p_search is null or p_search = '' or (
    st.name ilike '%' || p_search || '%'
    or coalesce(u.email, '') ilike '%' || p_search || '%'
    or exists (
      select 1 from public.restaurants r
      where r.managed_by_studio_id = st.id
        and r.name ilike '%' || p_search || '%'
    )
  );

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select
      st.id,
      st.name,
      st.created_at,
      st.owner_user_id,
      u.email as owner_email,
      u.last_sign_in_at,
      (
        select count(*) from public.restaurants r
        where r.managed_by_studio_id = st.id
      ) as restaurant_count,
      (
        select count(*) from public.restaurants r
        join public.subscriptions s on s.restaurant_id = r.id
        where r.managed_by_studio_id = st.id
          and s.status in ('active', 'trialing')
      ) as paid_count,
      (
        select count(*) from public.restaurants r
        where r.managed_by_studio_id = st.id
          and r.status = 'suspended'
      ) as suspended_count,
      (
        select count(*) from public.screens sc
        join public.restaurants r on r.id = sc.restaurant_id
        where r.managed_by_studio_id = st.id
      ) as screen_count,
      (
        select count(*) from public.menus m
        join public.restaurants r on r.id = m.restaurant_id
        where r.managed_by_studio_id = st.id
      ) as menu_count,
      (
        select coalesce(sum(ma.file_size_bytes), 0)
        from public.media_assets ma
        join public.restaurants r on r.id = ma.restaurant_id
        where r.managed_by_studio_id = st.id
      ) as storage_bytes,
      (
        select count(*) from public.restaurant_members rm
        join public.restaurants r on r.id = rm.restaurant_id
        where r.managed_by_studio_id = st.id
          and rm.role = 'operator'
          and rm.accepted_at is not null
      ) as operator_count,
      (
        select count(*) from public.restaurant_members rm
        join public.restaurants r on r.id = rm.restaurant_id
        where r.managed_by_studio_id = st.id
          and rm.role = 'operator'
          and rm.accepted_at is null
      ) as pending_invite_count
    from public.studios st
    left join auth.users u on u.id = st.owner_user_id
    where p_search is null or p_search = '' or (
      st.name ilike '%' || p_search || '%'
      or coalesce(u.email, '') ilike '%' || p_search || '%'
      or exists (
        select 1 from public.restaurants r
        where r.managed_by_studio_id = st.id
          and r.name ilike '%' || p_search || '%'
      )
    )
    order by st.created_at desc
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset)
  ) t;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

create or replace function public.admin_get_studio(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;

  select jsonb_build_object(
    'id', st.id,
    'name', st.name,
    'created_at', st.created_at,
    'owner_user_id', st.owner_user_id,
    'owner_email', u.email,
    'owner_last_sign_in_at', u.last_sign_in_at,
    'owner_created_at', u.created_at,
    'restaurant_count', (
      select count(*) from public.restaurants r where r.managed_by_studio_id = st.id
    ),
    'paid_count', (
      select count(*) from public.restaurants r
      join public.subscriptions s on s.restaurant_id = r.id
      where r.managed_by_studio_id = st.id and s.status in ('active', 'trialing')
    ),
    'unpaid_count', (
      select count(*) from public.restaurants r
      where r.managed_by_studio_id = st.id
        and not exists (
          select 1 from public.subscriptions s
          where s.restaurant_id = r.id and s.status in ('active', 'trialing')
        )
    ),
    'trial_count', (
      select count(*) from public.restaurants r
      where r.managed_by_studio_id = st.id
        and r.trial_ends_at > now()
        and not exists (
          select 1 from public.subscriptions s
          where s.restaurant_id = r.id and s.status in ('active', 'trialing')
        )
    ),
    'suspended_count', (
      select count(*) from public.restaurants r
      where r.managed_by_studio_id = st.id and r.status = 'suspended'
    ),
    'former_count', (
      select count(*) from public.restaurants r
      where r.created_by_studio_id = st.id
        and (r.managed_by_studio_id is distinct from st.id)
    ),
    'screen_count', (
      select count(*) from public.screens sc
      join public.restaurants r on r.id = sc.restaurant_id
      where r.managed_by_studio_id = st.id
    ),
    'online_screen_count', (
      select count(*) from public.screens sc
      join public.restaurants r on r.id = sc.restaurant_id
      where r.managed_by_studio_id = st.id
        and sc.last_seen_at > now() - interval '90 seconds'
    ),
    'menu_count', (
      select count(*) from public.menus m
      join public.restaurants r on r.id = m.restaurant_id
      where r.managed_by_studio_id = st.id
    ),
    'playlist_count', (
      select count(*) from public.playlists p
      join public.restaurants r on r.id = p.restaurant_id
      where r.managed_by_studio_id = st.id
    ),
    'media_count', (
      select count(*) from public.media_assets ma
      join public.restaurants r on r.id = ma.restaurant_id
      where r.managed_by_studio_id = st.id
    ),
    'storage_bytes', (
      select coalesce(sum(ma.file_size_bytes), 0)
      from public.media_assets ma
      join public.restaurants r on r.id = ma.restaurant_id
      where r.managed_by_studio_id = st.id
    ),
    'item_count', (
      select count(*) from public.menu_items i
      join public.menu_sections sec on sec.id = i.section_id
      join public.menus m on m.id = sec.menu_id
      join public.restaurants r on r.id = m.restaurant_id
      where r.managed_by_studio_id = st.id
    ),
    'operator_count', (
      select count(*) from public.restaurant_members rm
      join public.restaurants r on r.id = rm.restaurant_id
      where r.managed_by_studio_id = st.id
        and rm.role = 'operator'
        and rm.accepted_at is not null
    ),
    'pending_invite_count', (
      select count(*) from public.restaurant_members rm
      join public.restaurants r on r.id = rm.restaurant_id
      where r.managed_by_studio_id = st.id
        and rm.role = 'operator'
        and rm.accepted_at is null
    ),
    'last_screen_seen_at', (
      select max(sc.last_seen_at) from public.screens sc
      join public.restaurants r on r.id = sc.restaurant_id
      where r.managed_by_studio_id = st.id
    ),
    'last_menu_update_at', (
      select max(m.updated_at) from public.menus m
      join public.restaurants r on r.id = m.restaurant_id
      where r.managed_by_studio_id = st.id
    ),
    'restaurants', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      from (
        select
          r.id,
          r.name,
          r.status,
          r.trial_ends_at,
          r.created_at,
          r.currency,
          ou.email as operator_email,
          s.plan_id,
          s.status as subscription_status,
          (select count(*) from public.screens sc where sc.restaurant_id = r.id) as screen_count,
          (select count(*) from public.menus m where m.restaurant_id = r.id) as menu_count,
          (select count(*) from public.playlists p where p.restaurant_id = r.id) as playlist_count,
          (select coalesce(sum(ma.file_size_bytes), 0) from public.media_assets ma where ma.restaurant_id = r.id) as storage_bytes,
          (select max(sc.last_seen_at) from public.screens sc where sc.restaurant_id = r.id) as last_screen_seen_at,
          (
            select rm.invited_email from public.restaurant_members rm
            where rm.restaurant_id = r.id and rm.role = 'operator' and rm.accepted_at is null
            limit 1
          ) as pending_operator_email
        from public.restaurants r
        left join auth.users ou on ou.id = r.owner_id
        left join public.subscriptions s on s.restaurant_id = r.id
        where r.managed_by_studio_id = st.id
        order by r.created_at desc
      ) x
    ),
    'former_restaurants', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb)
      from (
        select
          r.id,
          r.name,
          r.status,
          r.created_at,
          ou.email as owner_email,
          s.plan_id,
          s.status as subscription_status
        from public.restaurants r
        left join auth.users ou on ou.id = r.owner_id
        left join public.subscriptions s on s.restaurant_id = r.id
        where r.created_by_studio_id = st.id
          and (r.managed_by_studio_id is distinct from st.id)
        order by r.created_at desc
      ) x
    )
  ) into v_row
  from public.studios st
  left join auth.users u on u.id = st.owner_user_id
  where st.id = p_id;

  if v_row is null then raise exception 'Studio not found'; end if;
  return v_row;
end;
$$;

create or replace function public.admin_update_studio(
  p_id uuid,
  p_name text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(trim(p_name), '');
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if v_name is null or char_length(v_name) < 2 then
    raise exception 'Studio name is required.';
  end if;

  update public.studios set name = v_name where id = p_id;
  if not found then raise exception 'Studio not found'; end if;

  perform public.log_admin_action(
    'update_studio',
    'studio',
    p_id,
    jsonb_build_object('name', v_name)
  );
end;
$$;

create or replace function public.admin_suspend_studio(
  p_id uuid,
  p_suspend boolean,
  p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if not exists (select 1 from public.studios where id = p_id) then
    raise exception 'Studio not found';
  end if;

  update public.restaurants set
    status = case when p_suspend then 'suspended' else 'active' end,
    suspended_at = case when p_suspend then now() else null end,
    suspended_reason = case
      when p_suspend then coalesce(nullif(trim(p_reason), ''), 'Studio suspended by platform admin')
      else null
    end
  where managed_by_studio_id = p_id;

  get diagnostics v_count = row_count;

  perform public.log_admin_action(
    case when p_suspend then 'suspend_studio' else 'unsuspend_studio' end,
    'studio',
    p_id,
    jsonb_build_object('reason', p_reason, 'restaurants', v_count)
  );

  return jsonb_build_object('ok', true, 'restaurants', v_count);
end;
$$;

revoke all on function public.admin_list_studios(text, int, int) from public;
revoke all on function public.admin_get_studio(uuid) from public;
revoke all on function public.admin_update_studio(uuid, text) from public;
revoke all on function public.admin_suspend_studio(uuid, boolean, text) from public;

grant execute on function public.admin_list_studios(text, int, int) to authenticated;
grant execute on function public.admin_get_studio(uuid) to authenticated;
grant execute on function public.admin_update_studio(uuid, text) to authenticated;
grant execute on function public.admin_suspend_studio(uuid, boolean, text) to authenticated;
