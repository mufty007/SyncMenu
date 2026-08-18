import { createClient } from "npm:@supabase/supabase-js@2";
import { adminClient, corsHeaders, json } from "../_shared/clover.ts";
import { callerRole, loadCallerRestaurant, parseJsonBody } from "../_shared/restaurant.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const body = parseJsonBody(await req.json().catch(() => ({})));
    const { restaurant, error: restErr } = await loadCallerRestaurant(
      supabase,
      typeof body.restaurant_id === "string" ? body.restaurant_id : null
    );
    if (!restaurant) return json({ error: restErr ?? "No restaurant" }, 400);
    const role = await callerRole(supabase, restaurant.id);
    if (role !== "owner" && role !== "designer") {
      return json({ error: "Only the designer or owner can disconnect Clover." }, 403);
    }

    const admin = adminClient();
    const { data: integration } = await admin
      .from("clover_integrations")
      .select("id")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();

    if (integration?.id) {
      await admin.from("clover_entity_map").delete().eq("integration_id", integration.id);
    }

    await admin
      .from("clover_integrations")
      .update({
        status: "disconnected",
        access_token: "",
        refresh_token: "",
        delivery_menu_id: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("restaurant_id", restaurant.id);

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Disconnect failed" }, 500);
  }
});
