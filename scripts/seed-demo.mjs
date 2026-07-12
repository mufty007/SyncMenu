// Seeds a demo user, restaurant, menus, and a playlist.
// Usage: node scripts/seed-demo.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { FEATURED_ITEMS, FOOD_IMAGES, FALLBACK_FOOD_IMAGE } from "./food-images.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const EMAIL = "syncmenu.demo1@gmail.com";
const PASSWORD = "SyncDemo123!";

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  // sign in if the user already exists, otherwise sign up
  let { data: auth, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) {
    ({ data: auth, error } = await supabase.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
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

  let { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!restaurant) {
    ({ data: restaurant, error } = await supabase
      .from("restaurants")
      .insert({
        owner_id: userId,
        name: "Big Bite Chicken",
        currency: "USD",
        brand_color: "#FF6B2C",
      })
      .select()
      .single());
    if (error) throw new Error(`Restaurant insert failed: ${error.message}`);
  }
  console.log(`Restaurant: ${restaurant.name} (${restaurant.id})`);

  const { count } = await supabase
    .from("menus")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurant.id);
  if (count > 0) {
    console.log(`Menus already exist (${count}) — skipping seed. Done.`);
    return;
  }

  async function createMenu({ name, template_id, template_config, orientation, sections }) {
    const { data: menu, error: mErr } = await supabase
      .from("menus")
      .insert({ restaurant_id: restaurant.id, name, template_id, template_config, orientation })
      .select()
      .single();
    if (mErr) throw new Error(`Menu "${name}": ${mErr.message}`);
    for (const [si, section] of sections.entries()) {
      const { data: sec, error: sErr } = await supabase
        .from("menu_sections")
        .insert({ menu_id: menu.id, name: section.name, sort_order: si })
        .select()
        .single();
      if (sErr) throw new Error(`Section "${section.name}": ${sErr.message}`);
      const rows = section.items.map(([iname, description, price], ii) => ({
        section_id: sec.id,
        name: iname,
        description,
        price,
        sort_order: ii,
        image_url: FOOD_IMAGES[iname] ?? FALLBACK_FOOD_IMAGE,
        featured: FEATURED_ITEMS.has(iname),
      }));
      const { error: iErr } = await supabase.from("menu_items").insert(rows);
      if (iErr) throw new Error(`Items for "${section.name}": ${iErr.message}`);
    }
    console.log(`Menu seeded: ${name} (${sections.length} sections)`);
    return menu;
  }

  const mainMenu = await createMenu({
    name: "Main Menu",
    template_id: "spotlight",
    template_config: { accent: "#1E3A5F", layoutRatio: "40-60", showImages: true },
    orientation: "landscape",
    sections: [
      {
        name: "Chicken",
        items: [
          ["6 Hot Wings", "Crispy, spicy, legendary", 5.9],
          ["Fillet Burger", "Fresh lettuce & house mayo", 6.5],
          ["Zinger Wrap", "Hash brown, cheese, hot sauce", 5.5],
          ["Family Bucket", "10 pcs, 4 fries, 2 large sides", 19.9],
        ],
      },
      {
        name: "Sides",
        items: [
          ["Peri Fries", "Dusted with peri-peri salt", 3.2],
          ["Coleslaw", "Made fresh daily", 2.0],
          ["Cheesy Bites", "6 breaded mozzarella bites", 3.5],
        ],
      },
      {
        name: "Drinks",
        items: [
          ["Soft Drink", "Coke, Fanta, Sprite — 500ml", 1.8],
          ["Fresh Orange Juice", "Squeezed to order", 2.9],
          ["Milkshake", "Chocolate, strawberry or vanilla", 3.4],
        ],
      },
    ],
  });

  const dealsMenu = await createMenu({
    name: "Lunch Deals",
    template_id: "chalk",
    template_config: { accent: "#FFB020" },
    orientation: "landscape",
    sections: [
      {
        name: "Meal Deals — 11am to 3pm",
        items: [
          ["Wings Meal", "6 wings, fries & a drink", 7.5],
          ["Burger Meal", "Any burger, fries & a drink", 8.0],
          ["Wrap Combo", "Wrap, cheesy bites & a drink", 7.9],
        ],
      },
      {
        name: "Add-Ons",
        items: [
          ["Extra Fries", "Upgrade to large", 1.0],
          ["Extra Dip", "BBQ, garlic or peri", 0.5],
        ],
      },
    ],
  });

  const { data: playlist, error: pErr } = await supabase
    .from("playlists")
    .insert({ restaurant_id: restaurant.id, name: "All-Day Rotation" })
    .select()
    .single();
  if (pErr) throw new Error(`Playlist: ${pErr.message}`);
  const { error: slErr } = await supabase.from("playlist_slides").insert([
    { playlist_id: playlist.id, menu_id: mainMenu.id, duration_seconds: 20, transition: "fade", sort_order: 0 },
    { playlist_id: playlist.id, menu_id: dealsMenu.id, duration_seconds: 10, transition: "slide-up", sort_order: 1 },
  ]);
  if (slErr) throw new Error(`Slides: ${slErr.message}`);
  console.log(`Playlist seeded: All-Day Rotation (2 slides)`);

  console.log("\nDone! Log in with:");
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
