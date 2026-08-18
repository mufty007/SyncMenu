// Seeds a designer studio user plus one client restaurant.
// Usage: node scripts/seed-designer-demo.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const EMAIL = "syncmenu.designer@gmail.com";
const PASSWORD = "SyncDemo123!";
const STUDIO_NAME = "Northside Menu Co.";
const CLIENT_NAME = "Harbor Coffee";

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  let { data: auth, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) {
    ({ data: auth, error } = await supabase.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
      options: { data: { account_type: "designer" } },
    }));
    if (error) throw new Error(`Signup failed: ${error.message}`);
    if (!auth.session) {
      throw new Error(
        "Signup succeeded but no session returned — email confirmation is " +
          "enabled. Disable it in Supabase: Authentication -> Sign In / Up -> " +
          "Email -> uncheck 'Confirm email', then rerun this script."
      );
    }
  }
  const userId = auth.user.id;
  console.log(`Signed in as ${EMAIL} (${userId})`);

  let { data: studio, error: studioErr } = await supabase
    .from("studios")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (studioErr) throw new Error(`Studio lookup failed: ${studioErr.message}`);

  if (!studio) {
    const { data, error: createErr } = await supabase.rpc("create_studio", {
      p_name: STUDIO_NAME,
    });
    if (createErr) throw new Error(`create_studio failed: ${createErr.message}`);
    studio = data;
    console.log(`Studio created: ${studio?.name ?? STUDIO_NAME}`);
  } else {
    console.log(`Studio exists: ${studio.name} (${studio.id})`);
  }

  const { data: memberships, error: memErr } = await supabase
    .from("restaurant_members")
    .select("restaurant_id")
    .eq("user_id", userId)
    .not("accepted_at", "is", null);
  if (memErr) throw new Error(`Membership lookup failed: ${memErr.message}`);

  let restaurantId = memberships?.[0]?.restaurant_id ?? null;
  if (!restaurantId) {
    const { data, error: restErr } = await supabase.rpc("studio_create_restaurant", {
      p_name: CLIENT_NAME,
    });
    if (restErr) throw new Error(`studio_create_restaurant failed: ${restErr.message}`);
    restaurantId = data;
    console.log(`Client restaurant created: ${CLIENT_NAME} (${restaurantId})`);
  } else {
    console.log(`Client restaurant already exists (${restaurantId})`);
  }

  const { count } = await supabase
    .from("menus")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  if (!count) {
    const { data: menu, error: menuErr } = await supabase
      .from("menus")
      .insert({
        restaurant_id: restaurantId,
        name: "Main Menu",
        template_id: "spotlight",
        template_config: { accent: "#FF6B2C" },
      })
      .select()
      .single();
    if (menuErr) throw new Error(`Menu insert failed: ${menuErr.message}`);

    const { data: section, error: secErr } = await supabase
      .from("menu_sections")
      .insert({ menu_id: menu.id, name: "Drinks", sort_order: 0 })
      .select()
      .single();
    if (secErr) throw new Error(`Section insert failed: ${secErr.message}`);

    const { error: itemErr } = await supabase.from("menu_items").insert([
      {
        section_id: section.id,
        name: "Flat White",
        description: "Double shot, silky milk",
        price: 4.5,
        sort_order: 0,
      },
      {
        section_id: section.id,
        name: "Iced Latte",
        description: "Oat milk available",
        price: 5.0,
        sort_order: 1,
      },
    ]);
    if (itemErr) throw new Error(`Items insert failed: ${itemErr.message}`);
    console.log(`Starter menu seeded: ${menu.name}`);
  } else {
    console.log(`Menus already exist (${count}) — skipping seed.`);
  }

  console.log("\nDone! Log in with:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log("  then open /studio");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
