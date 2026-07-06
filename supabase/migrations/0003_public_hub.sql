-- SyncMenu migration 0003 — restaurant hub: links, socials, dietary tags.
-- Run in the Supabase SQL editor after 0002.

alter table public.restaurants
  add column if not exists links jsonb not null default '{}'::jsonb,
  add column if not exists about text not null default '';

alter table public.menu_items
  add column if not exists tags text[] not null default '{}',
  add column if not exists calories int;

alter table public.menus
  add column if not exists show_on_hub boolean not null default true;

-- Redefine menu_payload to include dietary tags.
create or replace function public.menu_payload(m public.menus)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', m.id,
    'name', m.name,
    'template_id', m.template_id,
    'template_config', m.template_config,
    'orientation', m.orientation,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'menu_id', s.menu_id, 'name', s.name, 'sort_order', s.sort_order,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'section_id', i.section_id, 'name', i.name,
            'description', i.description, 'price', i.price,
            'image_url', i.image_url, 'available', i.available,
            'featured', i.featured, 'tags', i.tags, 'calories', i.calories,
            'sort_order', i.sort_order
          ) order by i.sort_order, i.name)
          from public.menu_items i where i.section_id = s.id
        ), '[]'::jsonb)
      ) order by s.sort_order, s.name)
      from public.menu_sections s where s.menu_id = m.id
    ), '[]'::jsonb)
  )
$$;

-- Customer hub: restaurant profile + all public menus in one call.
create or replace function public.get_restaurant_hub(p_restaurant uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_restaurant public.restaurants;
  v_menus jsonb;
begin
  select * into v_restaurant from public.restaurants where id = p_restaurant;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select coalesce(jsonb_agg(public.menu_payload(m.*) order by m.name), '[]'::jsonb)
    into v_menus
    from public.menus m
    where m.restaurant_id = p_restaurant and m.show_on_hub;
  return jsonb_build_object(
    'status', 'ok',
    'restaurant', jsonb_build_object(
      'id', v_restaurant.id,
      'name', v_restaurant.name,
      'logo_url', v_restaurant.logo_url,
      'brand_color', v_restaurant.brand_color,
      'currency', v_restaurant.currency,
      'links', v_restaurant.links,
      'about', v_restaurant.about
    ),
    'menus', v_menus
  );
end $$;

revoke all on function public.get_restaurant_hub(uuid) from public;
grant execute on function public.get_restaurant_hub(uuid) to anon, authenticated;
