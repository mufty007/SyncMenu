#!/usr/bin/env node
/**
 * Phase 0 — manual Clover Inventory API spike.
 *
 * Usage (sandbox):
 *   CLOVER_APP_ID=... CLOVER_APP_SECRET=... CLOVER_MERCHANT_ID=... \
 *   CLOVER_ACCESS_TOKEN=... node scripts/test-clover-spike.mjs
 *
 * Get a merchant access token by completing OAuth once, or use a sandbox API token
 * from the Clover Developer Dashboard test merchant.
 */
const env = process.env.CLOVER_ENVIRONMENT ?? "sandbox";
const merchantId = process.env.CLOVER_MERCHANT_ID;
const token = process.env.CLOVER_ACCESS_TOKEN;

const apiBase =
  env === "production"
    ? "https://api.clover.com"
    : "https://apisandbox.dev.clover.com";

if (!merchantId || !token) {
  console.error(
    "Set CLOVER_MERCHANT_ID and CLOVER_ACCESS_TOKEN (optional: CLOVER_ENVIRONMENT=sandbox|production)"
  );
  process.exit(1);
}

async function clover(path, { method = "GET", body } = {}) {
  const res = await fetch(`${apiBase}/v3/merchants/${merchantId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log(`\n=== Clover spike (${env}) merchant ${merchantId} ===\n`);

  const merchant = await clover("");
  console.log("Merchant:", merchant.name ?? merchant.id);

  const category = await clover("/categories", {
    method: "POST",
    body: { name: "SyncMenu Spike Category" },
  });
  console.log("Created category:", category.id, category.name);

  const items = [];
  for (const [name, priceCents] of [
    ["Spike Burger", 1299],
    ["Spike Fries", 499],
    ["Spike Drink", 299],
  ]) {
    const item = await clover("/items", {
      method: "POST",
      body: {
        name,
        price: priceCents,
        priceType: "FIXED",
        defaultTaxRates: true,
      },
    });
    await clover("/category_items", {
      method: "POST",
      body: { category: { id: category.id }, item: { id: item.id } },
    });
    items.push(item);
    console.log("Created item:", item.id, name, `$${(priceCents / 100).toFixed(2)}`);
  }

  // 86 the drink
  await clover(`/item_stocks/${items[2].id}`, {
    method: "POST",
    body: { quantity: 0, stockCount: 0 },
  });
  console.log("Set Spike Drink out of stock (quantity 0)");

  const listed = await clover("/items?limit=10&expand=categories,itemStock");
  console.log(
    "\nInventory sample:",
    (listed.elements ?? []).slice(0, 5).map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      stock: i.itemStock?.quantity,
    }))
  );

  console.log(
    "\nNext: confirm items in Clover Merchant Dashboard → Inventory → Online Ordering."
  );
  console.log("If Uber Eats / DoorDash are connected in Clover, verify menu propagation.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
