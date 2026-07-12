/** Verified Unsplash food photos for demo menus (all URLs return HTTP 200). */
const Q = "?w=800&q=80&auto=format&fit=crop";
const img = (id) => `https://images.unsplash.com/photo-${id}${Q}`;

// Reusable photo pool
const P = {
  wings: img("1527477396000-e27163b481c2"),
  wingsSpicy: img("1606755962773-d324e0a13086"),
  burger: img("1568901346375-23c9450c58cd"),
  burgerStack: img("1550547660-d9450f859349"),
  burgerFish: img("1551782450-a2132b4ba21d"),
  wrap: img("1626700051175-6818013e1d4f"),
  tenders: img("1562967914-608f82629710"),
  friedChicken: img("1594221708779-94832f4320d1"),
  fries: img("1573080496219-bb080dd4f877"),
  salad: img("1512621776951-a57141f2eefd"),
  macCheese: img("1543339494-b4cd4f7ba686"),
  biscuit: img("1509440159596-0249088772ff"),
  soda: img("1622483767028-3f66f32aef97"),
  juice: img("1600271886742-f049cd451bba"),
  shake: img("1513558161293-cdaf765ed2fd"),
  smoothieGreen: img("1610970881699-44a5587cabec"),
  smoothieBerry: img("1505252585461-04db1eb84625"),
  smoothie: img("1553530666-ba11a7da3888"),
  lamb: img("1546833999-b9f581a1996d"),
  lambChops: img("1558030006-450675393462"),
  grill: img("1544025162-d76694265947"),
  dessert: img("1578985545062-69928b1d9587"),
  cookie: img("1499636136210-6f4ee915583e"),
  pie: img("1586985289688-ca3cf47d3e6e"),
  shrimp: img("1565680018434-b513d5e5fd47"),
  fish: img("1519708227418-c8fd9a32b7a2"),
  pizza: img("1565299624946-b28f40a0ae38"),
  burgerMeal: img("1594212699903-ec8a3eca50f5"),
  gourmetBurger: img("1586190848861-99aa4a171e90"),
  icedTea: img("1556679343-c7306c1976bc"),
  sauce: img("1621996346565-e3dbc646d9a9"),
};

export const FOOD_IMAGES = {
  // Main menu — chicken
  "6 Hot Wings": P.wings,
  "Fillet Burger": P.burger,
  "Zinger Wrap": P.wrap,
  "Family Bucket": P.tenders,
  "Crispy Chicken": P.friedChicken,
  "Ghost Pepper Wings": P.wingsSpicy,

  // Burgers & sandwiches
  "Classic Burger": P.burgerStack,
  "Truffle Mayo Burger": P.gourmetBurger,
  "Fish Sandwich": P.fish,
  "Chicken Biscuit": P.biscuit,
  "#1 Sandwich Combo": P.burgerFish,

  // Combos & meals
  "Wings Meal": P.wings,
  "Burger Meal": P.burgerMeal,
  "Wrap Combo": P.wrap,
  "#2 Chicken Combo": P.tenders,
  "#3 Tenders": P.tenders,
  "Kids Box": P.tenders,
  "Shrimp Tackle Box": P.shrimp,

  // Sides
  "Peri Fries": P.fries,
  "Loaded Peri Fries": P.fries,
  "Truffle Fries": P.fries,
  "Extra Fries": P.fries,
  Coleslaw: P.salad,
  "Cheesy Bites": P.macCheese,
  "Onion Rings": P.fries,
  "Mac & Cheese": P.macCheese,
  Biscuit: P.biscuit,
  "Extra Dip": P.sauce,

  // Drinks
  "Soft Drink": P.soda,
  "Fresh Orange Juice": P.juice,
  Milkshake: P.shake,
  Lemonade: P.juice,
  "Iced Tea": P.icedTea,

  // Smoothies & juice
  "Green Machine": P.smoothieGreen,
  "Berry Blast": P.smoothieBerry,
  "Mango Sunrise": P.juice,
  "Protein Punch": P.smoothie,
  "Carrot & Orange": P.juice,
  "Watermelon Cooler": P.smoothie,

  // Grill & desserts
  "Lamb Chops": P.lambChops,
  "Half Chicken": P.friedChicken,
  "Mixed Grill Platter": P.grill,
  Baklava: P.dessert,
  Kunafa: P.dessert,
  "Apple Pie": P.pie,
  "Chocolate Chip Cookie": P.cookie,

  // Other
  "Classic Wrap": P.wrap,
  "Veggie Bowl": P.salad,
  "Cheese Bomb": P.dessert,
};

export const FEATURED_ITEMS = new Set([
  "6 Hot Wings",
  "Cheese Bomb",
  "Shrimp Tackle Box",
  "Ghost Pepper Wings",
  "#2 Chicken Combo",
  "Family Bucket",
]);

export const FALLBACK_FOOD_IMAGE = img("1504674900247-0877df9cc836");
