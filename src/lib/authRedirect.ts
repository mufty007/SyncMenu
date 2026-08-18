import { supabase } from "./supabase";

/** Where to send the user right after login or signup. */
export async function resolvePostAuthPath(preferred?: string): Promise<string> {
  if (preferred?.startsWith("/platform")) return preferred;
  if (preferred?.startsWith("/invite")) return preferred;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: isAdmin }, { data: studio }, { data: profile }, { data: memberships }] =
    await Promise.all([
      supabase.rpc("is_platform_admin"),
      supabase.from("studios").select("id").eq("owner_user_id", user?.id ?? "").maybeSingle(),
      supabase
        .from("profiles")
        .select("account_type")
        .eq("user_id", user?.id ?? "")
        .maybeSingle(),
      supabase
        .from("restaurant_members")
        .select("id")
        .eq("user_id", user?.id ?? "")
        .not("accepted_at", "is", null)
        .limit(1),
    ]);

  const designer = !!studio || profile?.account_type === "designer";

  if (designer) {
    if (preferred?.startsWith("/app") || preferred?.startsWith("/studio")) {
      return preferred;
    }
    return studio ? "/studio" : "/studio/setup";
  }

  if (isAdmin && !memberships?.length) return "/platform";
  return preferred ?? "/app";
}
