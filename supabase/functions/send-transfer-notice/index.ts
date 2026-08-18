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

    const { restaurant_id, origin } = (await req.json().catch(() => ({}))) as {
      restaurant_id?: string;
      origin?: string;
    };
    if (!restaurant_id) return json({ error: "Missing restaurant_id" }, 400);

    const role = await callerRole(supabase, restaurant_id);
    if (!role) return json({ error: "Not a member of this restaurant" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: transfer } = await admin
      .from("account_transfers")
      .select("id, direction, requested_by, status")
      .eq("restaurant_id", restaurant_id)
      .eq("status", "pending")
      .maybeSingle();
    if (!transfer || transfer.requested_by !== user.id) {
      return json({ error: "No pending transfer from this account" }, 404);
    }

    const { data: members } = await admin
      .from("restaurant_members")
      .select("user_id, role")
      .eq("restaurant_id", restaurant_id)
      .not("accepted_at", "is", null);

    const other = (members ?? []).find(
      (m: { user_id: string | null; role: string }) =>
        m.user_id && m.user_id !== user.id
    );
    if (!other?.user_id) return json({ ok: true, emailed: false });

    const { data: otherUser } = await admin.auth.admin.getUserById(other.user_id);
    const to = otherUser.user?.email;
    if (!to) return json({ ok: true, emailed: false });

    const { data: restaurant } = await admin
      .from("restaurants")
      .select("name")
      .eq("id", restaurant_id)
      .single();

    const config = await loadEmailConfig();
    if (!config) return json({ error: "Email is not configured" }, 503);

    const site = (origin || config.siteOrigin).replace(/\/$/, "");
    const url = `${site}/app/settings`;
    const restaurantName = restaurant?.name ?? "a restaurant";
    const what =
      transfer.direction === "to_restaurant"
        ? "full account control to the restaurant"
        : "design control back to the studio";

    await sendEmail(
      {
        to,
        subject: `Confirm a SyncMenu transfer for ${restaurantName}`,
        html: `<div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933">
          <h1 style="color:#FF6B2C;font-size:22px">Transfer request</h1>
          <p>The other party requested handing ${what} for <strong>${restaurantName}</strong>.</p>
          <p>The existing Stripe subscription stays as-is.</p>
          <p><a href="${url}" style="background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Review in SyncMenu</a></p>
        </div>`,
      },
      config
    );

    return json({ ok: true, emailed: true });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
