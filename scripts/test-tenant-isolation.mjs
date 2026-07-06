// Adversarial multi-tenancy test.
// Signs in as the demo owner (tenant A), records their data, then creates a
// second "attacker" account (tenant B) and tries every cross-tenant access:
// read, update, delete, and the public RPCs. Prints PASS/FAIL per check.
//
// Usage: node scripts/test-tenant-isolation.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const SUPA_URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

// separate clients so each keeps its own auth session
const A = createClient(SUPA_URL, KEY, { auth: { storageKey: "a" } });
const B = createClient(SUPA_URL, KEY, { auth: { storageKey: "b" } });

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
}

// ---- Tenant A: the demo owner ----
const { error: aErr } = await A.auth.signInWithPassword({
  email: "syncmenu.demo1@gmail.com",
  password: "SyncDemo123!",
});
if (aErr) throw new Error(`Demo sign-in failed: ${aErr.message}`);

const { data: aRest } = await A.from("restaurants").select("*").single();
const { data: aMenus } = await A.from("menus").select("id,name").eq("restaurant_id", aRest.id);
const { data: aScreens } = await A.from("screens").select("id,name").eq("restaurant_id", aRest.id);
const aMenu = aMenus?.[0];
const { data: aSections } = aMenu
  ? await A.from("menu_sections").select("id").eq("menu_id", aMenu.id)
  : { data: [] };
const aSection = aSections?.[0];
const { data: aItems } = aSection
  ? await A.from("menu_items").select("id,name,price").eq("section_id", aSection.id)
  : { data: [] };
const aItem = aItems?.[0];
console.log(
  `Tenant A: restaurant ${aRest.id}, ${aMenus?.length ?? 0} menus, ` +
    `${aScreens?.length ?? 0} screens, sample item ${aItem?.id ?? "none"}\n`
);

// ---- Tenant B: a fresh attacker account ----
const attackerEmail = `syncmenu.attacker+${Date.now()}@gmail.com`;
const { data: bAuth, error: bErr } = await B.auth.signUp({
  email: attackerEmail,
  password: "AttackerPass123!",
});
if (bErr) throw new Error(`Attacker sign-up failed: ${bErr.message}`);
if (!bAuth.session) {
  throw new Error("Attacker signup returned no session — enable auto-confirm to run this test.");
}
const { data: bRest } = await B.from("restaurants")
  .insert({ owner_id: bAuth.user.id, name: "Attacker Diner", currency: "USD" })
  .select()
  .single();
console.log(`Tenant B: restaurant ${bRest.id} (${attackerEmail})\n`);

// ---- READ isolation ----
const { data: seenRests } = await B.from("restaurants").select("id");
check(
  "B cannot see A's restaurant row",
  !seenRests?.some((r) => r.id === aRest.id),
  `B sees ${seenRests?.length ?? 0} restaurant(s)`
);

const { data: seenMenus } = await B.from("menus").select("id");
check(
  "B cannot list A's menus",
  !seenMenus?.some((m) => aMenus?.some((am) => am.id === m.id)),
  `B sees ${seenMenus?.length ?? 0} menu(s)`
);

const { data: directMenu } = await B.from("menus").select("*").eq("id", aMenu.id);
check("B cannot read A's menu by id", (directMenu?.length ?? 0) === 0);

const { data: seenScreens } = await B.from("screens").select("id");
check(
  "B cannot list A's screens",
  !seenScreens?.some((s) => aScreens?.some((as) => as.id === s.id)),
  `B sees ${seenScreens?.length ?? 0} screen(s)`
);

const { data: seenItems } = await B.from("menu_items").select("id");
check(
  "B cannot list A's menu items",
  !seenItems?.some((i) => i.id === aItem?.id),
  `B sees ${seenItems?.length ?? 0} item(s)`
);

const { data: seenSubs } = await B.from("subscriptions").select("restaurant_id");
check(
  "B cannot read A's subscription",
  !seenSubs?.some((s) => s.restaurant_id === aRest.id)
);

// ---- WRITE isolation ----
const { error: upMenuErr, count: upMenuCount } = await B.from("menus")
  .update({ name: "HACKED" }, { count: "exact" })
  .eq("id", aMenu.id);
check(
  "B cannot rename A's menu",
  (upMenuCount ?? 0) === 0,
  upMenuErr ? `blocked: ${upMenuErr.message}` : "0 rows affected"
);

const { count: upItemCount } = await B.from("menu_items")
  .update({ price: 0.01 }, { count: "exact" })
  .eq("id", aItem.id);
check("B cannot change A's item price", (upItemCount ?? 0) === 0);

const { error: insErr } = await B.from("menu_sections").insert({
  menu_id: aMenu.id,
  name: "Injected section",
});
check("B cannot insert a section into A's menu", Boolean(insErr), insErr?.message ?? "");

const { count: assignCount } = await B.from("screens")
  .update({ assigned_menu_id: aMenu.id }, { count: "exact" })
  .eq("id", aScreens?.[0]?.id ?? "00000000-0000-0000-0000-000000000000");
check("B cannot hijack A's screen assignment", (assignCount ?? 0) === 0);

// ---- DELETE isolation ----
const { count: delCount } = await B.from("menus")
  .delete({ count: "exact" })
  .eq("id", aMenu.id);
check("B cannot delete A's menu", (delCount ?? 0) === 0);

// ---- Verify A's data is untouched ----
const { data: aMenuAfter } = await A.from("menus").select("name").eq("id", aMenu.id).single();
check(
  "A's menu name unchanged after attacks",
  aMenuAfter?.name === aMenu.name,
  `still "${aMenuAfter?.name}"`
);
const { data: aItemAfter } = await A.from("menu_items").select("price").eq("id", aItem.id).single();
check("A's item price unchanged", Number(aItemAfter?.price) === Number(aItem.price));

// ---- Public RPCs are intentionally public (menus meant to be shared) ----
const { data: pub } = await B.rpc("get_public_menu", { p_menu: aMenu.id });
check(
  "get_public_menu is intentionally public (menu content only, no owner data)",
  pub?.status === "ok" && !("owner_id" in (pub.restaurant ?? {})),
  "returns menu without owner/email"
);

// ---- Cleanup attacker ----
await B.from("restaurants").delete().eq("id", bRest.id);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
