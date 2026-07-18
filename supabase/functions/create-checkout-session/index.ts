import { createClient } from "npm:@supabase/supabase-js@2";
import {
  SAAS_APP,
  corsHeaders,
  json,
  resolveAddonPriceId,
  resolvePriceId,
  stripe,
} from "../_shared/stripe.ts";

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
      .select("id, name")
      .eq("owner_id", user.id)
      .single();
    if (!restaurant) return json({ error: "No restaurant for this account" }, 400);

    const { plan, interval, origin, addons = [] } = await req.json();
    if (
      !Array.isArray(addons) ||
      addons.some((addon) => addon !== "clover") ||
      new Set(addons).size !== addons.length
    ) {
      return json({ error: "Unknown add-on" }, 400);
    }
    const price = await resolvePriceId(plan, interval);
    const addonPrices = await Promise.all(
      addons.map((addon: string) => resolveAddonPriceId(addon, interval))
    );

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    if (addons.includes("clover")) {
      const { data: cloverConfig } = await admin.rpc("service_clover_config");
      if (!(cloverConfig as { enabled?: boolean } | null)?.enabled) {
        return json({ error: "Clover is not currently available" }, 503);
      }
    }
    const { data: existing } = await admin
      .from("subscriptions")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();

    if (existing?.status === "active" || existing?.status === "trialing") {
      return json({ error: "Already subscribed — use Manage billing to change plans." }, 400);
    }

    let customerId = existing?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: restaurant.name,
        metadata: {
          restaurant_id: restaurant.id,
          saas: SAAS_APP,
        },
      });
      customerId = customer.id;
      await admin.from("subscriptions").upsert({
        restaurant_id: restaurant.id,
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        { price, quantity: 1 },
        ...addonPrices.map((addonPrice) => ({ price: addonPrice, quantity: 1 })),
      ],
      success_url: `${origin}/app/billing?success=1`,
      cancel_url: `${origin}/app/billing?canceled=1`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          restaurant_id: restaurant.id,
          plan_id: plan,
          addons: addons.join(","),
          saas: SAAS_APP,
        },
      },
      metadata: {
        restaurant_id: restaurant.id,
        plan_id: plan,
        addons: addons.join(","),
        saas: SAAS_APP,
      },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
