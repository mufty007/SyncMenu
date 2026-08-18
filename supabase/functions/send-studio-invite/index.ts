import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/stripe.ts";
import { loadEmailConfig, sendEmail } from "../_shared/email.ts";
import { callerRole } from "../_shared/restaurant.ts";

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

    const { token, origin } = (await req.json().catch(() => ({}))) as {
      token?: string;
      origin?: string;
    };
    if (!token) return json({ error: "Missing invite token" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: invite } = await admin
      .from("restaurant_members")
      .select("restaurant_id, invited_email, role, accepted_at, invite_expires_at")
      .eq("invite_token", token)
      .maybeSingle();
    if (!invite || invite.accepted_at || !invite.invited_email) {
      return json({ error: "Invite not found" }, 404);
    }
    if (invite.invite_expires_at && new Date(invite.invite_expires_at) < new Date()) {
      return json({ error: "Invite has expired" }, 400);
    }

    const role = await callerRole(supabase, invite.restaurant_id);
    if (role !== "designer" && role !== "owner") {
      return json({ error: "Not allowed to send this invite" }, 403);
    }

    const { data: restaurant } = await admin
      .from("restaurants")
      .select("name")
      .eq("id", invite.restaurant_id)
      .single();

    const config = await loadEmailConfig();
    if (!config) return json({ error: "Email is not configured" }, 503);

    const site = (origin || config.siteOrigin).replace(/\/$/, "");
    const url = `${site}/invite/${token}`;
    const restaurantName = restaurant?.name ?? "a restaurant";
    const asWho =
      invite.role === "designer" ? "the menu designer" : "the restaurant operator";

    await sendEmail(
      {
        to: invite.invited_email,
        subject: `You're invited to ${restaurantName} on SyncMenu`,
        html: `<div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933">
          <h1 style="color:#FF6B2C;font-size:22px">You're invited</h1>
          <p>Join <strong>${restaurantName}</strong> on SyncMenu as ${asWho}.</p>
          <p><a href="${url}" style="background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Accept invite</a></p>
          <p style="color:#9AA5B1;font-size:12px">This link expires in 14 days.</p>
        </div>`,
      },
      config
    );

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
