import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  getIntegrationForRestaurant,
  hasCloverEntitlement,
  json,
  loadCloverConfig,
} from "../_shared/clover.ts";
import { importCloverMenu } from "../_shared/clover-import.ts";
import { callerRole, loadCallerRestaurant, parseJsonBody } from "../_shared/restaurant.ts";

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

    const body = parseJsonBody(await req.json().catch(() => ({})));
    const { restaurant, error: restErr } = await loadCallerRestaurant(
      supabase,
      typeof body.restaurant_id === "string" ? body.restaurant_id : null
    );
    if (!restaurant) return json({ error: restErr ?? "No restaurant for this account" }, 400);
    const role = await callerRole(supabase, restaurant.id);
    if (role !== "owner" && role !== "designer") {
      return json({ error: "Only the designer or owner can import from Clover." }, 403);
    }
    if (!(await hasCloverEntitlement(restaurant.id))) {
      return json({ error: "An active Clover add-on is required" }, 403);
    }

    const integration = await getIntegrationForRestaurant(restaurant.id);
    if (!integration || !["pending", "active", "error"].includes(integration.status)) {
      return json({ error: "Connect Clover before importing" }, 400);
    }

    const forceNew = body.force_new === true;
    const templateId = typeof body.template_id === "string" ? body.template_id : undefined;

    if (
      !forceNew &&
      integration.imported_menu_id &&
      integration.initial_import_status === "done"
    ) {
      return json({
        ok: true,
        already_imported: true,
        menu_id: integration.imported_menu_id,
        message: "A Clover menu was already imported. Pass force_new to import again into a new menu.",
      });
    }

    const result = await importCloverMenu(config, integration, {
      brandColor: restaurant.brand_color ?? undefined,
      templateId,
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
