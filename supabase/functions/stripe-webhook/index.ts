import { createClient } from "npm:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@17";
import { json, planFromPrice, stripe } from "../_shared/stripe.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function syncSubscription(sub: Stripe.Subscription) {
  let restaurantId = sub.metadata?.restaurant_id as string | undefined;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  if (!restaurantId) {
    const { data } = await admin
      .from("subscriptions")
      .select("restaurant_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    restaurantId = data?.restaurant_id;
  }
  if (!restaurantId) {
    console.error(`No restaurant found for customer ${customerId}`);
    return;
  }

  const item = sub.items.data[0];
  await admin.from("subscriptions").upsert({
    restaurant_id: restaurantId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    plan_id:
      (sub.metadata?.plan_id as string | undefined) ??
      planFromPrice(item?.price) ??
      null,
    price_id: item?.price.id ?? null,
    status: sub.status,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing signature" }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("Signature verification failed:", (err as Error).message);
    return json({ error: "Invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id
          );
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (err) {
    console.error(err);
    return json({ error: "Handler failed" }, 500);
  }

  return json({ received: true });
});
