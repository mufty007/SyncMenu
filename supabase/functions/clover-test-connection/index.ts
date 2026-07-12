import { createClient } from "npm:@supabase/supabase-js@2";
import {
  CloverApiClient,
  adminClient,
  corsHeaders,
  json,
  loadCloverConfig,
} from "../_shared/clover.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) return json({ error: "Platform admin only" }, 403);

    const config = await loadCloverConfig();
    if (!config) {
      return json({ ok: false, error: "Clover credentials not configured" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const merchantId = body.merchant_id as string | undefined;
    const accessToken = body.access_token as string | undefined;

    if (!merchantId || !accessToken) {
      return json({
        ok: true,
        message: "Credentials saved. Provide merchant_id and access_token to test API access.",
        configured: true,
      });
    }

    const client = new CloverApiClient(config, merchantId, accessToken);
    const merchant = await client.getMerchant();
    return json({
      ok: true,
      merchant: { id: merchant.id, name: merchant.name },
    });
  } catch (err) {
    console.error(err);
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Connection test failed" },
      400
    );
  }
});
