// Manual webhook smoke test — requires Stripe secrets in .env (never commit them).
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  return Object.fromEntries(
    readFileSync(new URL("../.env", import.meta.url), "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
}

const env = loadEnv();
const WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;
const STRIPE_KEY = env.STRIPE_SECRET_KEY;
const restaurantId = process.argv[2] ?? env.STRIPE_TEST_RESTAURANT_ID;
const subId = process.argv[3] ?? env.STRIPE_TEST_SUBSCRIPTION_ID;

if (!WEBHOOK_SECRET || !STRIPE_KEY) {
  console.error(
    "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env (see .env.example). " +
      "These are for local scripts only — never commit them."
  );
  process.exit(1);
}
if (!restaurantId || !subId) {
  console.error(
    "Usage: node scripts/test-webhook.mjs <restaurant_id> <subscription_id>\n" +
      "Or set STRIPE_TEST_RESTAURANT_ID and STRIPE_TEST_SUBSCRIPTION_ID in .env"
  );
  process.exit(1);
}

const wh = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=10", {
  headers: { Authorization: `Bearer ${STRIPE_KEY}` },
});
const whJson = await wh.json();
console.log(
  "Stripe webhook endpoints:",
  whJson.data?.map((w) => ({ url: w.url, status: w.status, events: w.enabled_events }))
);

const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
  headers: { Authorization: `Bearer ${STRIPE_KEY}` },
});
const sub = await subRes.json();
if (sub.error) {
  console.error("Stripe:", sub.error.message);
  process.exit(1);
}

const event = {
  id: "evt_test_manual",
  object: "event",
  type: "customer.subscription.updated",
  data: { object: sub },
};

const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
const signedPayload = `${timestamp}.${payload}`;
const sig = crypto.createHmac("sha256", WEBHOOK_SECRET).update(signedPayload, "utf8").digest("hex");

const res = await fetch(
  `${env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": `t=${timestamp},v1=${sig}`,
    },
    body: payload,
  }
);
const text = await res.text();
console.log("Webhook handler response:", res.status, text);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { data: row } = await sb
  .from("subscriptions")
  .select("*")
  .eq("restaurant_id", restaurantId)
  .single();
console.log("DB after webhook:", JSON.stringify(row, null, 2));

if (row?.status === "active" && row?.stripe_subscription_id === subId) {
  console.log("PASS: Webhook handler syncs subscription correctly");
} else {
  process.exit(1);
}
