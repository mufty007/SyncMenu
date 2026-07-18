import Stripe from "npm:stripe@17";

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

/** Shared Khidmah platform product — SyncMenu prices live under this product. */
export const STRIPE_PRODUCT_ID =
  Deno.env.get("STRIPE_PRODUCT_ID") ?? "prod_UqPvU72LORrOEE";

/** Identifies this SaaS on shared Stripe customers/subscriptions. */
export const SAAS_APP = Deno.env.get("STRIPE_SAAS_APP") ?? "syncmenu";

/** Stripe price nicknames (must match Dashboard → Product → Pricing). */
export const PRICE_NICKNAMES: Record<string, Record<string, string>> = {
  starter: { monthly: "Starter", yearly: "Starter Yearly" },
  growth: { monthly: "Growth", yearly: "Growth Yearly" },
  pro: { monthly: "Pro", yearly: "Pro Yearly" },
};

/** Recurring add-on price nicknames under the same Stripe product. */
export const ADDON_PRICE_NICKNAMES: Record<string, Record<string, string>> = {
  clover: { monthly: "Clover", yearly: "Clover Yearly" },
};

/** Optional — set if you created a portal configuration in the shared account. */
export const PORTAL_CONFIGURATION =
  Deno.env.get("STRIPE_PORTAL_CONFIGURATION") ?? undefined;

let priceCache: Map<string, string> | null = null;
let priceCacheAt = 0;
const PRICE_CACHE_MS = 5 * 60 * 1000;

async function loadPriceNicknames(): Promise<Map<string, string>> {
  if (priceCache && Date.now() - priceCacheAt < PRICE_CACHE_MS) {
    return priceCache;
  }
  const prices = await stripe.prices.list({
    product: STRIPE_PRODUCT_ID,
    active: true,
    limit: 100,
  });
  const map = new Map<string, string>();
  for (const p of prices.data) {
    if (p.nickname) map.set(p.nickname, p.id);
  }
  priceCache = map;
  priceCacheAt = Date.now();
  return map;
}

/** Resolve a plan + interval to a Stripe price ID via product nicknames. */
export async function resolvePriceId(
  plan: string,
  interval: string
): Promise<string> {
  const nickname = PRICE_NICKNAMES[plan]?.[interval];
  if (!nickname) {
    throw new Error(`Unknown plan or interval: ${plan}/${interval}`);
  }
  const cache = await loadPriceNicknames();
  const id = cache.get(nickname);
  if (!id) {
    throw new Error(
      `Stripe price "${nickname}" not found on product ${STRIPE_PRODUCT_ID}. ` +
        "Check nicknames in the Khidmah product pricing table."
    );
  }
  return id;
}

/** Resolve an add-on + interval to a Stripe price ID via product nicknames. */
export async function resolveAddonPriceId(
  addon: string,
  interval: string
): Promise<string> {
  const nickname = ADDON_PRICE_NICKNAMES[addon]?.[interval];
  if (!nickname) {
    throw new Error(`Unknown add-on or interval: ${addon}/${interval}`);
  }
  const cache = await loadPriceNicknames();
  const id = cache.get(nickname);
  if (!id) {
    throw new Error(
      `Stripe price "${nickname}" not found on product ${STRIPE_PRODUCT_ID}. ` +
        "Check nicknames in the Khidmah product pricing table."
    );
  }
  return id;
}

/** Map a Stripe price nickname back to our plan_id. */
export function planFromNickname(nickname: string | null | undefined): string | null {
  if (!nickname) return null;
  const n = nickname.toLowerCase();
  if (n.includes("starter")) return "starter";
  if (n.includes("growth")) return "growth";
  if (n.includes("pro")) return "pro";
  return null;
}

export function planFromPrice(price: Stripe.Price | undefined): string | null {
  if (!price) return null;
  return (
    planFromNickname(price.nickname) ??
    (price.lookup_key ? planFromNickname(price.lookup_key) : null)
  );
}

export function addonFromNickname(
  nickname: string | null | undefined
): string | null {
  if (!nickname) return null;
  const normalized = nickname.toLowerCase();
  if (normalized.includes("clover")) return "clover";
  return null;
}

export function addonFromPrice(price: Stripe.Price | undefined): string | null {
  if (!price) return null;
  return (
    addonFromNickname(price.nickname) ??
    (price.lookup_key ? addonFromNickname(price.lookup_key) : null)
  );
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
