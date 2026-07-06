import Stripe from "npm:stripe@17";

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

/** plan + interval → Stripe price. Server-side allowlist; never trust client price IDs. */
export const PRICES: Record<string, Record<string, string>> = {
  starter: {
    monthly: "price_1TpxtAEIKu2buCASGf6RCPtc",
    yearly: "price_1TpxtBEIKu2buCASgWkPF8O8",
  },
  growth: {
    monthly: "price_1TpxtBEIKu2buCASVYv9KBNN",
    yearly: "price_1TpxtBEIKu2buCASJrhciqPy",
  },
  pro: {
    monthly: "price_1TpxtCEIKu2buCAS9joy0Vq9",
    yearly: "price_1TpxtCEIKu2buCASLdGHKFOq",
  },
};

export const PORTAL_CONFIGURATION = "bpc_1TpxuREIKu2buCAS7L0N4Sx6";

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
