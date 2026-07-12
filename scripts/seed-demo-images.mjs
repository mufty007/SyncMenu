// Attaches food photos to all Big Bite Chicken demo menu items.
// Usage: node scripts/seed-demo-images.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { FALLBACK_FOOD_IMAGE, FEATURED_ITEMS, FOOD_IMAGES } from "./food-images.mjs";

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
  const { data: auth, error: aErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (aErr) throw new Error(aErr.message);

  const { data: restaurant, error: rErr } = await supabase
    .from("restaurants")
    .select("id, name")
    .eq("owner_id", auth.user.id)
    .single();
  if (rErr || !restaurant) throw new Error("Demo restaurant not found — run seed-demo.mjs first.");

  console.log(`Restaurant: ${restaurant.name}`);

  const { data: menus, error: mErr } = await supabase
    .from("menus")
    .select("id, name, template_id, template_config")
    .eq("restaurant_id", restaurant.id);
  if (mErr) throw new Error(mErr.message);
  if (!menus?.length) throw new Error("No menus found — run seed-demo.mjs first.");

  const menuIds = menus.map((m) => m.id);
  const { data: sections, error: sErr } = await supabase
    .from("menu_sections")
    .select("id, menu_id, name")
    .in("menu_id", menuIds);
  if (sErr) throw new Error(sErr.message);

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: items, error: iErr } = await supabase
    .from("menu_items")
    .select("id, name, section_id, image_url, featured")
    .in("section_id", sectionIds);
  if (iErr) throw new Error(iErr.message);

  let updated = 0;
  let featured = 0;
  const wingsItemId = items?.find((i) => i.name === "6 Hot Wings")?.id ?? null;
  const cheeseBombId = items?.find((i) => i.name === "Cheese Bomb")?.id ?? null;
  const shrimpId = items?.find((i) => i.name === "Shrimp Tackle Box")?.id ?? null;

  for (const item of items ?? []) {
    const image_url = FOOD_IMAGES[item.name] ?? FALLBACK_FOOD_IMAGE;
    const isFeatured = FEATURED_ITEMS.has(item.name);
    const patch = { image_url, featured: isFeatured };
    if (item.image_url === image_url && item.featured === isFeatured) continue;

    const { error } = await supabase.from("menu_items").update(patch).eq("id", item.id);
    if (error) throw new Error(`Updating "${item.name}": ${error.message}`);
    updated++;
    if (isFeatured) featured++;
    console.log(`  ✓ ${item.name}`);
  }

  // Upgrade key menus for photo-forward templates
  const mainMenu = menus.find((m) => m.name === "Main Menu");
  if (mainMenu) {
    await supabase
      .from("menus")
      .update({
        template_id: "spotlight",
        template_config: {
          ...mainMenu.template_config,
          accent: "#1E3A5F",
          layoutRatio: "40-60",
          heroItemId: wingsItemId,
          showImages: true,
        },
      })
      .eq("id", mainMenu.id);
    console.log("Main Menu → Spotlight template with hero wings");
  }

  const spotlightMenu = menus.find((m) => m.name === "Spotlight Specials");
  if (spotlightMenu && cheeseBombId) {
    const chefSection = sections?.find(
      (s) => s.menu_id === spotlightMenu.id && s.name === "Chef's Pick"
    );
    await supabase
      .from("menus")
      .update({
        template_config: {
          ...spotlightMenu.template_config,
          heroItemId: cheeseBombId,
          heroSectionId: chefSection?.id ?? null,
        },
      })
      .eq("id", spotlightMenu.id);
    console.log("Spotlight Specials → hero Cheese Bomb");
  }

  const promoMenu = menus.find((m) => m.name === "Promo Spotlight");
  if (promoMenu && shrimpId) {
    const featSection = sections?.find(
      (s) => s.menu_id === promoMenu.id && s.name === "Featured"
    );
    await supabase
      .from("menus")
      .update({
        template_config: {
          ...promoMenu.template_config,
          heroItemId: shrimpId,
          heroSectionId: featSection?.id ?? null,
        },
      })
      .eq("id", promoMenu.id);
    console.log("Promo Spotlight → hero Shrimp Tackle Box");
  }

  console.log(`\nDone — ${updated} items updated, ${featured} featured.`);
  console.log(`Log in: ${EMAIL} / ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
