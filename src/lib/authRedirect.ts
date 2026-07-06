import { supabase } from "./supabase";

/** Where to send the user right after login or signup. */
export async function resolvePostAuthPath(
  preferred?: string
): Promise<string> {
  if (preferred?.startsWith("/platform")) return preferred;

  const [{ data: isAdmin }, { data: restaurant }] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase.from("restaurants").select("id").maybeSingle(),
  ]);

  if (isAdmin && !restaurant) return "/platform";
  return preferred ?? "/app";
}
