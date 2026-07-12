import { createClient } from "npm:@supabase/supabase-js@2";
import { adminClient, corsHeaders, json } from "../_shared/clover.ts";

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

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (!restaurant) return json({ error: "No restaurant" }, 400);

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
