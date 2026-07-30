import {
  adminClient,
  cloverUrls,
  getIntegrationForRestaurant,
  hasCloverEntitlement,
  loadCloverConfig,
  redirect,
  siteOrigin,
  verifyOAuthState,
} from "../_shared/clover.ts";
import { importCloverMenu } from "../_shared/clover-import.ts";

Deno.serve(async (req) => {
  const origin = siteOrigin();
  const fail = (msg: string, intent: string = "integrations") => {
    const path =
      intent === "onboarding_import"
        ? `/onboarding?clover=error&message=${encodeURIComponent(msg)}`
        : `/app/settings/integrations?clover=error&message=${encodeURIComponent(msg)}`;
    return redirect(`${origin}${path}`);
  };

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const merchantId = url.searchParams.get("merchant_id");
    const error = url.searchParams.get("error");

    if (error) return fail(error);
    if (!code || !state) return fail("Missing OAuth code or state");

    const config = await loadCloverConfig();
    if (!config) return fail("Clover is not configured");
    if (!config.enabled) return fail("Clover integration is not enabled");

    const verified = await verifyOAuthState(config.oauth_state_secret, state);
    if (!verified) return fail("Invalid or expired OAuth state");
    const { restaurantId, intent } = verified;

    if (!(await hasCloverEntitlement(restaurantId))) {
      return fail("An active Clover add-on is required", intent);
    }

    const urls = cloverUrls(config.environment);
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/clover-oauth-callback`;

    const body = new URLSearchParams({
      client_id: config.app_id,
      client_secret: config.app_secret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(urls.oauthToken, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("Clover token exchange failed", tokenData);
      return fail("Clover authorization failed", intent);
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = tokenData.refresh_token as string;
    const expiresIn = Number(tokenData.access_token_expiration ?? tokenData.expires_in ?? 3600);
    const cloverMerchantId =
      merchantId ??
      (tokenData.merchant_id as string | undefined) ??
      (tokenData.merchantId as string | undefined);

    if (!cloverMerchantId) return fail("Clover did not return a merchant ID", intent);

    const admin = adminClient();
    await admin.from("clover_integrations").upsert(
      {
        restaurant_id: restaurantId,
        clover_merchant_id: cloverMerchantId,
        access_token: accessToken,
        refresh_token: refreshToken,
        access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        status: "pending",
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id" }
    );

    if (intent === "onboarding_import") {
      try {
        const integration = await getIntegrationForRestaurant(restaurantId);
        if (integration) {
          const result = await importCloverMenu(config, integration);
          return redirect(
            `${origin}/onboarding?clover=imported&menu_id=${result.menu_id}`
          );
        }
      } catch (importErr) {
        console.error(importErr);
        const msg =
          importErr instanceof Error ? importErr.message : "Import failed after connect";
        return redirect(
          `${origin}/onboarding?clover=error&message=${encodeURIComponent(msg)}`
        );
      }
    }

    return redirect(`${origin}/app/settings/integrations?clover=connected`);
  } catch (err) {
    console.error(err);
    return fail(err instanceof Error ? err.message : "OAuth callback failed");
  }
});
