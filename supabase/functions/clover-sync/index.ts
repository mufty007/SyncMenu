import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adminClient,
  corsHeaders,
  getIntegrationForRestaurant,
  hasCloverEntitlement,
  json,
  loadCloverConfig,
  logCloverSync,
} from "../_shared/clover.ts";
import { processSyncJob } from "../_shared/clover-sync.ts";

const MAX_JOBS = 20;
const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const config = await loadCloverConfig();
    if (!config) return json({ error: "Clover not configured" }, 503);
    if (!config.enabled) return json({ error: "Clover integration is disabled" }, 503);

    const cronSecret = req.headers.get("X-Cron-Secret");
    const isCron = cronSecret && cronSecret === config.cron_secret;

    let restaurantId: string | null = null;
    let manualFullPush = false;

    if (!isCron) {
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

      const body = await req.json().catch(() => ({}));
      manualFullPush = body.action === "sync_now";

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (!restaurant) return json({ error: "No restaurant" }, 400);
      restaurantId = restaurant.id;
      if (!(await hasCloverEntitlement(restaurantId))) {
        return json({ error: "An active Clover add-on is required" }, 403);
      }

      if (manualFullPush) {
        await adminClient().from("clover_sync_queue").insert({
          restaurant_id: restaurantId,
          job_type: "full_push",
          payload: { reason: "manual" },
        });
      }
    }

    const admin = adminClient();
    let query = admin
      .from("clover_sync_queue")
      .select("*")
      .is("processed_at", null)
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(MAX_JOBS);

    if (restaurantId) {
      query = query.eq("restaurant_id", restaurantId);
    }

    const { data: jobs } = await query;
    const processed: string[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const job of jobs ?? []) {
      if (!(await hasCloverEntitlement(job.restaurant_id))) {
        await admin
          .from("clover_sync_queue")
          .update({
            processed_at: new Date().toISOString(),
            last_error: "Clover add-on is not active",
          })
          .eq("id", job.id);
        continue;
      }
      const integration = await getIntegrationForRestaurant(job.restaurant_id);
      if (!integration || integration.status === "disconnected") {
        await admin
          .from("clover_sync_queue")
          .update({ processed_at: new Date().toISOString(), last_error: "Not connected" })
          .eq("id", job.id);
        continue;
      }
      if (!integration.delivery_menu_id && job.job_type !== "full_push") {
        await admin
          .from("clover_sync_queue")
          .update({ processed_at: new Date().toISOString(), last_error: "No delivery menu" })
          .eq("id", job.id);
        continue;
      }

      try {
        await processSyncJob(
          config,
          integration,
          job.job_type,
          (job.payload ?? {}) as Record<string, unknown>
        );
        await admin
          .from("clover_sync_queue")
          .update({ processed_at: new Date().toISOString(), last_error: null })
          .eq("id", job.id);
        processed.push(job.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        errors.push({ id: job.id, error: message });
        await admin
          .from("clover_sync_queue")
          .update({
            attempts: (job.attempts ?? 0) + 1,
            last_error: message,
          })
          .eq("id", job.id);
        await admin
          .from("clover_integrations")
          .update({ status: "error", last_error: message, updated_at: new Date().toISOString() })
          .eq("id", integration.id);
        await logCloverSync(job.restaurant_id, job.job_type, "error", { message });
      }
    }

    // Coalesce: after processing incremental jobs for a restaurant, skip duplicate pending item upserts
    if (isCron && (jobs ?? []).length >= MAX_JOBS) {
      // more jobs remain for next cron tick
    }

    return json({
      ok: true,
      processed: processed.length,
      errors,
      manual: manualFullPush,
    });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Sync worker failed" }, 500);
  }
});
