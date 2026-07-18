import { createClient } from "npm:@supabase/supabase-js@2";
import {
  cloverUrls,
  corsHeaders,
  hasCloverEntitlement,
  json,
  loadCloverConfig,
  signOAuthState,
} from "../_shared/clover.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const config = await loadCloverConfig();
    if (!config?.enabled) {
      return json({ error: "Clover integration is not enabled" }, 503);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", user.id)
      .single();
    if (!restaurant) return json({ error: "No restaurant for this account" }, 400);
    if (!(await hasCloverEntitlement(restaurant.id))) {
      return json({ error: "An active Clover add-on is required" }, 403);
    }

    const expiresAt = Date.now() + 15 * 60 * 1000;
    const state = await signOAuthState(config.oauth_state_secret, restaurant.id, expiresAt);
    const urls = cloverUrls(config.environment);
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/clover-oauth-callback`;

    const params = new URLSearchParams({
      client_id: config.app_id,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });

    return json({ url: `${urls.oauthAuthorize}?${params.toString()}` });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "OAuth start failed" }, 500);
  }
});
