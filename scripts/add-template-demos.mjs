import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("file:///C:/Users/gadda/OneDrive/Desktop/projects/SyncMenu/.env"), "utf8")
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

const { data: existing } = await supabase
  .from("menus")
  .select("name")
  .eq("restaurant_id", restaurant.id);
const names = new Set((existing ?? []).map((m) => m.name));

async function createMenu({ name, template_id, template_config, orientation, sections }) {
  if (names.has(name)) {
    console.log(`Skip (exists): ${name}`);
    return;
  }
  const { data: menu, error } = await supabase
    .from("menus")
    .insert({ restaurant_id: restaurant.id, name, template_id, template_config, orientation })
    .select()
    .single();
  if (error) throw new Error(error.message);
  for (const [si, section] of sections.entries()) {
    const { data: sec, error: sErr } = await supabase
      .from("menu_sections")
      .insert({ menu_id: menu.id, name: section.name, sort_order: si })
      .select()
      .single();
    if (sErr) throw new Error(sErr.message);
    const rows = section.items.map(([iname, description, price], ii) => ({
      section_id: sec.id,
      name: iname,
      description,
      price,
      sort_order: ii,
    }));
    const { error: iErr } = await supabase.from("menu_items").insert(rows);
    if (iErr) throw new Error(iErr.message);
  }
  console.log(`Seeded: ${name}`);
}

await createMenu({
  name: "Evening Grill",
  template_id: "luxe",
  template_config: { accent: "#D4AF7A" },
  orientation: "landscape",
  sections: [
    {
      name: "From the Grill",
      items: [
        ["Lamb Chops", "Char-grilled, mint & garlic marinade", 16.9],
        ["Half Chicken", "Slow-flamed with our house rub", 11.5],
        ["Mixed Grill Platter", "Lamb, chicken & kofta for two", 27.0],
      ],
    },
    {
      name: "To Finish",
      items: [
        ["Baklava", "Pistachio, warm honey syrup", 4.5],
        ["Kunafa", "Cheese-filled, rose syrup", 5.5],
      ],
    },
  ],
});

await createMenu({
  name: "Smoothies & Juice",
  template_id: "market",
  template_config: { accent: "#22B573" },
  orientation: "landscape",
  sections: [
    {
      name: "Fresh Blends",
      items: [
        ["Green Machine", "Spinach, apple, ginger, lime", 4.9],
        ["Berry Blast", "Strawberry, blueberry, banana", 4.9],
        ["Mango Sunrise", "Mango, orange, passion fruit", 5.2],
        ["Protein Punch", "Peanut butter, oats, banana, whey", 5.9],
      ],
    },
    {
      name: "Cold-Pressed",
      items: [
        ["Carrot & Orange", "With a hint of turmeric", 3.9],
        ["Watermelon Cooler", "Pure pressed watermelon & mint", 3.9],
      ],
    },
  ],
});

await createMenu({
  name: "House Special Board",
  template_id: "custom",
  template_config: {
    accent: "#7C3AED",
    footerText: "Free wifi: BigBite-Guest · Loyalty card: 10th meal free",
    footerTicker: true,
    custom: {
      headerAlign: "left",
      headerStyle: "band",
      sectionStyle: "cards",
      itemStyle: "pills",
      bodyFont: "grotesk",
      colors: {
        bg: "#F6F4FB",
        heading: "#241B3A",
        text: "#241B3A",
        muted: "#6B6480",
        price: "#7C3AED",
        card: "#FFFFFF",
      },
    },
  },
  orientation: "landscape",
  sections: [
    {
      name: "This Week Only",
      items: [
        ["Truffle Mayo Burger", "Limited run — while it lasts", 9.5],
        ["Loaded Peri Fries", "Cheese, jalapeños, house sauce", 5.9],
      ],
    },
    {
      name: "Always On",
      items: [
        ["Classic Wrap", "Grilled chicken, garlic mayo", 6.0],
        ["Kids Box", "4 nuggets, fries & a juice", 4.5],
      ],
    },
  ],
});

console.log("Done.");
