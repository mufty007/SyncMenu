// End-to-end Stripe integration smoke test (Khidmah shared account).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const origin = "http://localhost:5173";
const plans = ["starter", "growth", "pro"];
const intervals = ["monthly", "yearly"];

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function pass(msg) {
  console.log("PASS:", msg);
}

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const text = await error.context?.text?.().catch(() => null);
    return { ok: false, status: error.context?.status, data, text };
  }
  return { ok: true, data };
}

// --- 1. Fresh account so stale Stripe IDs don't block checkout ---
const email = `stripe-test-${Date.now()}@syncmenu.test`;
const password = "StripeTest123!";

console.log("\n=== Stripe integration test ===\n");
console.log("Test user:", email);

const { data: signup, error: signErr } = await supabase.auth.signUp({ email, password });
if (signErr) fail(`Signup: ${signErr.message}`);
if (!signup.session) fail("Signup returned no session — disable email confirmation in Supabase Auth.");
pass("Signed up test user");

const userId = signup.user.id;
const { data: restaurant, error: rErr } = await supabase
  .from("restaurants")
  .insert({
    owner_id: userId,
    name: "Stripe Test Kitchen",
    currency: "USD",
    brand_color: "#FF6B2C",
  })
  .select("id")
  .single();
if (rErr) fail(`Restaurant: ${rErr.message}`);
pass(`Created restaurant ${restaurant.id}`);

// --- 2. Checkout sessions for every plan + interval ---
for (const plan of plans) {
  for (const interval of intervals) {
    const res = await invoke("create-checkout-session", { plan, interval, origin });
    if (!res.ok) fail(`create-checkout-session ${plan}/${interval}: ${res.text ?? res.data?.error}`);
    const url = res.data?.url;
    if (!url?.startsWith("https://checkout.stripe.com/")) {
      fail(`Bad checkout URL for ${plan}/${interval}: ${url}`);
    }
    pass(`Checkout session ${plan}/${interval} → ${url.slice(0, 60)}…`);
  }
}

// --- 3. Subscription row created with Stripe customer ---
const { data: sub } = await supabase
  .from("subscriptions")
  .select("*")
  .eq("restaurant_id", restaurant.id)
  .maybeSingle();
if (!sub?.stripe_customer_id?.startsWith("cus_")) {
  fail(`Expected stripe_customer_id after checkout invoke, got: ${JSON.stringify(sub)}`);
}
pass(`Stripe customer created: ${sub.stripe_customer_id}`);

// --- 4. Customer portal (may fail until first paid subscription) ---
const portal = await invoke("customer-portal", { origin });
if (!portal.ok) {
  const msg = portal.text ?? portal.data?.error ?? "";
  if (msg.includes("No such customer")) {
    fail(`Portal: customer ${sub.stripe_customer_id} not found in Stripe — wrong API key or account?`);
  }
  // Portal can work without active subscription if customer exists
  console.log("NOTE: Portal response:", msg);
} else if (!portal.data?.url?.includes("billing.stripe.com")) {
  fail(`Bad portal URL: ${portal.data?.url}`);
} else {
  pass(`Customer portal opens: ${portal.data.url.slice(0, 60)}…`);
}

// --- 5. Demo account sanity (informational) ---
await supabase.auth.signOut();
const { error: demoErr } = await supabase.auth.signInWithPassword({
  email: "syncmenu.demo1@gmail.com",
  password: "SyncDemo123!",
});
if (!demoErr) {
  const { data: demoRest } = await supabase.from("restaurants").select("id").eq("owner_id", (await supabase.auth.getUser()).data.user.id).single();
  const { data: demoSub } = await supabase.from("subscriptions").select("status,stripe_customer_id,stripe_subscription_id").eq("restaurant_id", demoRest.id).maybeSingle();
  if (demoSub?.status === "active" && demoSub.stripe_customer_id) {
    const demoPortal = await invoke("customer-portal", { origin });
    if (!demoPortal.ok && (demoPortal.text ?? "").includes("No such customer")) {
      console.log(
        "\nWARN: Demo account has active subscription in DB but Stripe customer is missing.",
        "This is leftover from the old Stripe account — reset subscriptions row or re-subscribe."
      );
    }
  }
}

console.log("\n=== All checkout price lookups OK ===\n");
console.log("Next: complete one checkout in browser with card 4242 4242 4242 4242");
console.log("Then confirm webhook updates subscriptions.status to active.\n");
