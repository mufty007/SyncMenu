import { createClient } from "npm:@supabase/supabase-js@2";
import { PORTAL_CONFIGURATION, corsHeaders, json, stripe } from "../_shared/stripe.ts";
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
    const origin = body.origin as string;
    const { restaurant, error: restErr } = await loadCallerRestaurant(
      supabase,
      typeof body.restaurant_id === "string" ? body.restaurant_id : null
    );
    if (!restaurant) return json({ error: restErr ?? "No restaurant for this account" }, 400);

    const role = await callerRole(supabase, restaurant.id);
    if (role !== "owner" && role !== "operator") {
      return json({ error: "The restaurant owner manages billing." }, 403);
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle();
    if (!sub?.stripe_customer_id) {
      return json({ error: "No billing account yet — subscribe first." }, 400);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      ...(PORTAL_CONFIGURATION ? { configuration: PORTAL_CONFIGURATION } : {}),
      return_url: `${origin}/app/billing`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
