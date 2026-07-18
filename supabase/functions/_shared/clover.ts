import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

export function redirect(url: string, status = 302) {
  return new Response(null, { status, headers: { Location: url, ...corsHeaders } });
}

export type CloverEnvironment = "sandbox" | "production";

export interface CloverPlatformConfig {
  app_id: string;
  app_secret: string;
  environment: CloverEnvironment;
  oauth_state_secret: string;
  enabled: boolean;
  cron_secret?: string;
}

export interface CloverUrls {
  oauthAuthorize: string;
  oauthToken: string;
  apiBase: string;
}

export function cloverUrls(env: CloverEnvironment): CloverUrls {
  if (env === "production") {
    return {
      oauthAuthorize: "https://www.clover.com/oauth/v2/authorize",
      oauthToken: "https://www.clover.com/oauth/v2/token",
      apiBase: "https://api.clover.com",
    };
  }
  return {
    oauthAuthorize: "https://sandbox.dev.clover.com/oauth/v2/authorize",
    oauthToken: "https://sandbox.dev.clover.com/oauth/v2/token",
    apiBase: "https://apisandbox.dev.clover.com",
  };
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

export async function loadCloverConfig(): Promise<CloverPlatformConfig | null> {
  const admin = adminClient();
  const { data, error } = await admin.rpc("service_clover_config");
  if (error) throw new Error(`Failed to load Clover config: ${error.message}`);
  const raw = data as Record<string, unknown>;
  const appId = String(raw.app_id ?? "");
  const appSecret = String(raw.app_secret ?? "");
  const oauthStateSecret = String(raw.oauth_state_secret ?? "");
  if (!appId || !appSecret || !oauthStateSecret) return null;
  return {
    app_id: appId,
    app_secret: appSecret,
    environment: (raw.environment === "production" ? "production" : "sandbox") as CloverEnvironment,
    oauth_state_secret: oauthStateSecret,
    enabled: Boolean(raw.enabled),
    cron_secret: raw.cron_secret ? String(raw.cron_secret) : undefined,
  };
}

export async function hasCloverEntitlement(
  restaurantId: string
): Promise<boolean> {
  const admin = adminClient();
  const { data, error } = await admin.rpc("restaurant_addon_enabled", {
    p_restaurant_id: restaurantId,
    p_addon_id: "clover",
  });
  if (error) {
    throw new Error(`Failed to check Clover entitlement: ${error.message}`);
  }
  return data === true;
}

export async function signOAuthState(
  secret: string,
  restaurantId: string,
  expiresAt: number
): Promise<string> {
  const payload = `${restaurantId}:${expiresAt}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return btoa(payload).replace(/=+$/, "") + "." + sigB64;
}

export async function verifyOAuthState(
  secret: string,
  state: string
): Promise<{ restaurantId: string } | null> {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return null;
  const payload = atob(payloadB64);
  const [restaurantId, expiresStr] = payload.split(":");
  const expiresAt = Number(expiresStr);
  if (!restaurantId || !expiresAt || Date.now() > expiresAt) return null;

  const expected = await signOAuthState(secret, restaurantId, expiresAt);
  if (expected !== state) return null;
  return { restaurantId };
}

export interface CloverIntegrationRow {
  id: string;
  restaurant_id: string;
  clover_merchant_id: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  delivery_menu_id: string | null;
  status: string;
}

export async function getIntegrationForRestaurant(
  restaurantId: string
): Promise<CloverIntegrationRow | null> {
  const admin = adminClient();
  const { data } = await admin
    .from("clover_integrations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return data as CloverIntegrationRow | null;
}

export async function refreshAccessTokenIfNeeded(
  config: CloverPlatformConfig,
  integration: CloverIntegrationRow
): Promise<string> {
  const expiresAt = new Date(integration.access_token_expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return integration.access_token;

  const urls = cloverUrls(config.environment);
  const body = new URLSearchParams({
    client_id: config.app_id,
    client_secret: config.app_secret,
    refresh_token: integration.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch(urls.oauthToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Clover token refresh failed: ${JSON.stringify(data)}`);
  }

  const accessToken = data.access_token as string;
  const refreshToken = (data.refresh_token as string) ?? integration.refresh_token;
  const expiresIn = Number(data.access_token_expiration ?? data.expires_in ?? 3600);

  const admin = adminClient();
  await admin
    .from("clover_integrations")
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);

  return accessToken;
}

export class CloverApiClient {
  constructor(
    private config: CloverPlatformConfig,
    private merchantId: string,
    private accessToken: string
  ) {}

  private base() {
    return `${cloverUrls(this.config.environment).apiBase}/v3/merchants/${this.merchantId}`;
  }

  async request<T = unknown>(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const res = await fetch(`${this.base()}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!res.ok) {
      throw new Error(
        `Clover ${options.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(data)}`
      );
    }
    return data as T;
  }

  createCategory(name: string) {
    return this.request<{ id: string; name: string }>("/categories", {
      method: "POST",
      body: { name },
    });
  }

  updateCategory(categoryId: string, name: string) {
    return this.request(`/categories/${categoryId}`, {
      method: "POST",
      body: { name },
    });
  }

  deleteCategory(categoryId: string) {
    return this.request(`/categories/${categoryId}`, { method: "DELETE" });
  }

  createItem(payload: Record<string, unknown>) {
    return this.request<{ id: string }>("/items", { method: "POST", body: payload });
  }

  updateItem(itemId: string, payload: Record<string, unknown>) {
    return this.request(`/items/${itemId}`, { method: "POST", body: payload });
  }

  hideItem(itemId: string) {
    return this.updateItem(itemId, { hidden: true });
  }

  linkItemToCategory(categoryId: string, itemId: string) {
    return this.request("/category_items", {
      method: "POST",
      body: { category: { id: categoryId }, item: { id: itemId } },
    });
  }

  setItemStock(itemId: string, available: boolean) {
    return this.request(`/item_stocks/${itemId}`, {
      method: "POST",
      body: available
        ? { quantity: null, stockCount: null }
        : { quantity: 0, stockCount: 0 },
    });
  }

  getMerchant() {
    return this.request<Record<string, unknown>>("");
  }
}

export function priceToCents(price: number): number {
  return Math.round(Number(price) * 100);
}

export async function logCloverSync(
  restaurantId: string,
  action: string,
  status: string,
  details: Record<string, unknown> = {}
) {
  const admin = adminClient();
  await admin.from("clover_sync_log").insert({
    restaurant_id: restaurantId,
    action,
    status,
    details,
  });
}

export function siteOrigin(): string {
  return (
    Deno.env.get("SITE_URL") ??
    Deno.env.get("VITE_SITE_URL") ??
    "https://syncmenuapp.com"
  );
}
