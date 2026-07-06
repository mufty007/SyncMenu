-- SyncMenu migration 0002 — featured items + public customer menu RPC.
-- Run in the Supabase SQL editor after 0001.

alter table public.menu_items
  add column if not exists featured boolean not null default false;

-- Redefine menu_payload to include the new flag.
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
            'featured', i.featured, 'sort_order', i.sort_order
          ) order by i.sort_order, i.name)
          from public.menu_items i where i.section_id = s.id
        ), '[]'::jsonb)
      ) order by s.sort_order, s.name)
      from public.menu_sections s where s.menu_id = m.id
    ), '[]'::jsonb)
  )
$$;

-- Customer-facing menu: anyone with the (unguessable) menu link can read it.
create or replace function public.get_public_menu(p_menu uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_menu public.menus;
  v_restaurant public.restaurants;
begin
  select * into v_menu from public.menus where id = p_menu;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into v_restaurant from public.restaurants where id = v_menu.restaurant_id;
  return jsonb_build_object(
    'status', 'ok',
    'restaurant', jsonb_build_object(
      'name', v_restaurant.name,
      'logo_url', v_restaurant.logo_url,
      'brand_color', v_restaurant.brand_color,
      'currency', v_restaurant.currency
    ),
    'menu', public.menu_payload(v_menu)
  );
end $$;

revoke all on function public.get_public_menu(uuid) from public;
grant execute on function public.get_public_menu(uuid) to anon, authenticated;
