// Smoke test: sign in as demo and create a Stripe checkout session.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { error: aErr } = await supabase.auth.signInWithPassword({
  email: "syncmenu.demo1@gmail.com",
  password: "SyncDemo123!",
});
if (aErr) throw new Error(aErr.message);

const { data, error } = await supabase.functions.invoke("create-checkout-session", {
  body: { plan: "growth", interval: "monthly", origin: "http://localhost:5173" },
});
if (error) {
  console.error("Function error:", error.message);
  const body = await error.context?.text?.().catch(() => null);
  if (body) console.error("Response body:", body);
  process.exit(1);
}
console.log("Checkout URL:", data.url?.slice(0, 80) + "…");
console.log("OK — checkout session created.");
