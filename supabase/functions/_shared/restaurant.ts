import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface CallerRestaurant {
  id: string;
  name: string;
  managed_by_studio_id: string | null;
  owner_id: string | null;
  brand_color: string | null;
}

export async function loadCallerRestaurant(
  supabase: SupabaseClient,
  restaurantId?: string | null
): Promise<{ restaurant: CallerRestaurant | null; error: string | null }> {
  let query = supabase
    .from("restaurants")
    .select("id, name, managed_by_studio_id, owner_id, brand_color");
  if (restaurantId) {
    const { data, error } = await query.eq("id", restaurantId).maybeSingle();
    if (error || !data) {
      return { restaurant: null, error: "No restaurant for this account" };
    }
    return { restaurant: data as CallerRestaurant, error: null };
  }
  const { data, error } = await query;
  if (error) return { restaurant: null, error: error.message };
  const rows = (data ?? []) as CallerRestaurant[];
  if (rows.length === 1) return { restaurant: rows[0], error: null };
  if (rows.length === 0) {
    return { restaurant: null, error: "No restaurant for this account" };
  }
  return { restaurant: null, error: "restaurant_id required" };
}

export async function callerRole(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<string | null> {
  const { data } = await supabase.rpc("user_restaurant_role", {
    p_restaurant_id: restaurantId,
  });
  return (data as string | null) ?? null;
}

export function parseJsonBody(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}
