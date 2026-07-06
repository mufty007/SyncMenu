// Multi-tenancy attack suite: a second account tries to read/write the
// demo restaurant's data. Every attempt must come back empty or rejected.
// Usage: node scripts/test-tenancy.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const DEMO = { email: "syncmenu.demo1@gmail.com", password: "SyncDemo123!" };
const ATTACKER = { email: "syncmenu.tenant2@gmail.com", password: "TenantTest123!" };

const results = [];
function check(name, blocked, detail = "") {
  results.push({ name, blocked, detail });
  console.log(`${blocked ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function newClient() {
  return createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

/* ---------- collect victim (demo) IDs ---------- */
const demo = newClient();
{
  const { error } = await demo.auth.signInWithPassword(DEMO);
  if (error) throw new Error(`Demo login failed: ${error.message}`);
}
const { data: victimRestaurant } = await demo
  .from("restaurants")
  .select("id")
  .single();
const { data: victimMenus } = await demo.from("menus").select("id").limit(1);
const victimMenu = victimMenus?.[0];
const { data: victimSections } = await demo
  .from("menu_sections")
  .select("id, items:menu_items(id, price)")
  .eq("menu_id", victimMenu.id)
  .limit(1);
const victimSection = victimSections?.[0];
const victimItem = victimSection?.items?.[0];

// ensure the victim has a screen (pair one via the real flow)
let { data: victimScreens } = await demo.from("screens").select("id").limit(1);
if (!victimScreens?.length) {
  const { data: session } = await demo.r