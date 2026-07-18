import { createClient } from "npm:@supabase/supabase-js@2";
import type Stripe from "npm:stripe@17";
import {
  addonFromPrice,
  json,
  planFromPrice,
  stripe,
} from "../_shared/stripe.ts";
import { sendAutomation } from "../_shared/automation.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function ownerEmailForRestaurant(restaurantId: string): Promise<{
  userId: string;
  email: string;
  restaurantName: string;
} | null> {
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("owner_id, name")
    .eq("id", restaurantId)
    .single();
  if (!restaurant) return null;

  const { data: user } = await admin.auth.admin.getUserById(restaurant.owner_id);
  if (!user?.user?.email) return null;

  return {
    userId: restaurant.owner_id,
    email: user.user.email,
    restaurantName: restaurant.name,
  };
}

async function syncSubscription(
  sub: Stripe.Subscription,
  prevStatus?: string | null
): Promise<void> {
  let restaurantId = sub.metadata?.restaurant_id as string | undefined;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  if (!restaurantId) {
    const { data } = await admin
      .from("subscriptions")
      .select("restaurant_id, status")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    restaurantId = data?.restaurant_id;
    if (!prevStatus && data?.status) prevStatus = data.status;
  }
  if (!restaurantId) {
    console.error(`No restaurant found for customer ${customerId}`);
    return;
  }

  // Subscription event payloads can truncate items. Always enumerate the
  // subscription so base plans and every add-on are synchronized.
  const subscriptionItems = await stripe.subscriptionItems.list({
    subscription: sub.id,
    limit: 100,
  });
  const planItem = subscriptionItems.data.find(
    (candidate) => planFromPrice(candidate.price) !== null
  );
  const planId =
    planFromPrice(planItem?.price) ??
    (sub.metadata?.plan_id as string | undefined) ??
    null;

  await admin.from("subscriptions").upsert({
    restaurant_id: restaurantId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    plan_id: planId,
    price_id: planItem?.price.id ?? null,
    status: sub.status,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });

  const addonItems = subscriptionItems.data
    .map((item) => ({ item, addonId: addonFromPrice(item.price) }))
    .filter(
      (entry): entry is { item: Stripe.SubscriptionItem; addonId: string } =>
        entry.addonId !== null
    );

  for (const { item: addonItem, addonId } of addonItems) {
    await admin.from("subscription_addons").upsert({
      restaurant_id: restaurantId,
      addon_id: addonId,
      stripe_subscription_id: sub.id,
      stripe_subscription_item_id: addonItem.id,
      price_id: addonItem.price.id,
      status: sub.status,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    });
  }

  const activeAddonIds = new Set(addonItems.map((entry) => entry.addonId));
  if (!activeAddonIds.has("clover")) {
    await admin
      .from("subscription_addons")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("addon_id", "clover");
  }

  const owner = await ownerEmailForRestaurant(restaurantId);
  if (!owner) return;

  const planName =
    planId === "starter"
      ? "Starter"
      : planId === "growth"
        ? "Growth"
        : planId === "pro"
          ? "Pro"
          : planId || "SyncMenu";

  const vars = {
    restaurant_name: owner.restaurantName,
    owner_email: owner.email,
    plan_name: planName,
  };

  const newlyActive =
    (sub.status === "active" || sub.status === "trialing") &&
    prevStatus !== "active" &&
    prevStatus !== "trialing";

  if (newlyActive) {
    try {
      await sendAutomation("subscription_confirmed", {
        userId: owner.userId,
        restaurantId,
        email: owner.email,
        vars,
      });
    } catch (e) {
      console.error("subscription_confirmed automation failed", e);
    }
  }

  if (sub.status === "past_due" && prevStatus !== "past_due") {
    try {
      await sendAutomation("payment_failed", {
        userId: owner.userId,
        restaurantId,
        email: owner.email,
        vars,
      });
    } catch (e) {
      console.error("payment_failed automation failed", e);
    }
  }
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
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const prev = (event.data as { previous_attributes?: { status?: string } })
          .previous_attributes?.status;
        await syncSubscription(sub, prev ?? null);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub, "active");
        }
        break;
      }
    }
  } catch (err) {
    console.error(err);
    return json({ error: "Handler failed" }, 500);
  }

  return json({ received: true });
});
