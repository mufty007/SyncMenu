import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  getIntegrationForRestaurant,
  hasCloverEntitlement,
  json,
  loadCloverConfig,
} from "../_shared/clover.ts";
import { importCloverMenu } from "../_shared/clover-import.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const config = await loadCloverConfig();
    if (!config?.enabled) {
      return json({ error: "Clover integration is not enabled" }, 503);
    }

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
      .select("id, brand_color")
      .eq("owner_id", user.id)
      .single();
    if (!restaurant) return json({ error: "No restaurant for this account" }, 400);
    if (!(await hasCloverEntitlement(restaurant.id))) {
      return json({ error: "An active Clover add-on is required" }, 403);
    }

    const integration = await getIntegrationForRestaurant(restaurant.id);
    if (!integration || !["pending", "active", "error"].includes(integration.status)) {
      return json({ error: "Connect Clover before importing" }, 400);
    }

    let body: { force_new?: boolean; template_id?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }

    // Re-import creates a new menu; first import also creates new
    if (
      !body.force_new &&
      integration.imported_menu_id &&
      integration.initial_import_status === "done"
    ) {
      // Still allow re-import as new menu when force_new; otherwise return existing
      return json({
        ok: true,
        already_imported: true,
        menu_id: integration.imported_menu_id,
        message: "A Clover menu was already imported. Pass force_new to import again into a new menu.",
      });
    }

    const result = await importCloverMenu(config, integration, {
      brandColor: restaurant.brand_color ?? undefined,
      templateId: body.template_id,
    });

    return json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Clover import failed" },
      500
    );
  }
});
