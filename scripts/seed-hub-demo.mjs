// Seeds hub demo data (links, about, dietary tags) for the demo account.
// Requires migration 0003. Usage: node scripts/seed-hub-demo.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data: auth, error: aErr } = await supabase.auth.signInWithPassword({
  email: "syncmenu.demo1@gmail.com",
  password: "SyncDemo123!",
});
if (aErr) throw new Error(aErr.message);

const { data: restaurant } = await supabase
  .from("restaurants")
  .select("*")
  .eq("owner_id", auth.user.id)
  .single();

const { error: rErr } = await supabase
  .from("restaurants")
  .update({
    about: "Flame-grilled chicken since 2012 — halal certified",
    links: {
      ubereats: "https://www.ubereats.com/store/big-bite-chicken",
      doordash: "https://www.doordash.com/store/big-bite-chicken",
      phone: "+1 555 234 5678",
      website: "https://bigbitechicken.example.com",
      instagram: "https://instagram.com/bigbitechicken",
      tiktok: "https://tiktok.com/@bigbitechicken",
      google_maps: "https://maps.app.goo.gl/bigbite",
    },
  })
  .eq("id", restaurant.id);
if (rErr) throw new Error(`Restaurant update failed: ${rErr.message}`);
console.log("Links & about set.");

// Tag a few demo items by name (tags + calories per serving).
const ITEM_META = {
  "6 Hot Wings": { tags: ["spicy", "halal"], calories: 540 },
  "Zinger Wrap": { tags: ["spicy", "halal"], calories: 610 },
  "Fillet Burger": { tags: ["halal"], calories: 650 },
  "Family Bucket": { tags: ["halal"], calories: 2400 },
  "Peri Fries": { tags: ["vegetarian", "spicy"], calories: 380 },
  Coleslaw: { tags: ["vegetarian", "gluten-free"], calories: 150 },
  "Cheesy Bites": { tags: ["vegetarian"], calories: 420 },
  "Green Machine": { tags: ["vegan", "gluten-free"], calories: 180 },
  "Berry Blast": { tags: ["vegan", "gluten-free"], calories: 210 },
  "Carrot & Orange": { tags: ["vegan", "gluten-free"], calories: 120 },
  "Watermelon Cooler": { tags: ["vegan", "gluten-free"], calories: 90 },
  "Lamb Chops": { tags: ["halal"], calories: 720 },
  "Half Chicken": { tags: ["halal"], calories: 810 },
  "Mixed Grill Platter": { tags: ["halal"], calories: 1650 },
};

for (const [name, meta] of Object.entries(ITEM_META)) {
  const { error } = await supabase.from("menu_items").update(meta).eq("name", name);
  if (error) throw new Error(`Updating "${name}" failed: ${error.message}`);
}
console.log(`Updated tags & calories on ${Object.keys(ITEM_META).length} item names.`);
console.log(`\nHub URL: http://localhost:5173/r/${restaurant.id}`);
