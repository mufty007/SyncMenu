import { createClient } from "npm:@supabase/supabase-js@2";
import {
  addonFromPrice,
  corsHeaders,
  json,
  planFromPrice,
  resolveAddonPriceId,
  stripe,
} from "../_shared/stripe.ts";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

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
    if (!restaurant) return json({ error: "No restaurant for this account" }, 400);

    const body = await req.json().catch(() => ({}));
    const action = body.action as "add" | "remove" | undefined;
    if (action !== "add" && action !== "remove") {
      return json({ error: "Action must be add or remove" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: subscriptionRow } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();

    if (
      !subscriptionRow?.stripe_subscription_id ||
      !ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionRow.status ?? "")
    ) {
      return json({ error: "An active SyncMenu subscription is required" }, 400);
    }

    const { data: cloverConfig } = await admin.rpc("service_clover_config");
    if (action === "add" && !(cloverConfig as { enabled?: boolean } | null)?.enabled) {
      return json({ error: "Clover is not currently available" }, 503);
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscriptionRow.stripe_subscription_id
    );
    const items = await stripe.subscriptionItems.list({
      subscription: stripeSubscription.id,
      limit: 100,
    });
    const existingCloverItem = items.data.find(
      (item) => addonFromPrice(item.price) === "clover"
    );

    if (action === "remove") {
      if (existingCloverItem) {
        await stripe.subscriptionItems.del(existingCloverItem.id, {
          proration_behavior: "create_prorations",
        });
      }
      await admin
        .from("subscription_addons")
        .delete()
        .eq("restaurant_id", restaurant.id)
        .eq("addon_id", "clover");
      return json({ ok: true, active: false });
    }

    if (existingCloverItem) {
      return json({ ok: true, active: true });
    }

    const planItem = items.data.find(
      (item) => planFromPrice(item.price) !== null
    );
    const recurringInterval = planItem?.price.recurring?.interval;
    const interval = recurringInterval === "year" ? "yearly" : "monthly";
    const cloverPriceId = await resolveAddonPriceId("clover", interval);

    const updated = await stripe.subscriptions.update(stripeSubscription.id, {
      items: [{ price: cloverPriceId, quantity: 1 }],
      proration_behavior: "create_prorations",
      payment_behavior: "error_if_incomplete",
    });
    const addedItem = updated.items.data.find(
      (item) => addonFromPrice(item.price) === "clover"
    );
    if (!addedItem) {
      throw new Error("Stripe did not return the Clover subscription item");
    }

    await admin.from("subscription_addons").upsert({
      restaurant_id: restaurant.id,
      addon_id: "clover",
      stripe_subscription_id: updated.id,
      stripe_subscription_item_id: addedItem.id,
      price_id: addedItem.price.id,
      status: updated.status,
      current_period_end: updated.current_period_end
        ? new Date(updated.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    });

    return json({ ok: true, active: true, interval });
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : "Could not update Clover billing" },
      500
    );
  }
});
