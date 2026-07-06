import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/stripe.ts";
import { sendEmail, unsubscribeFooter } from "../_shared/email.ts";

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) return json({ error: "Not authorized" }, 403);

    const { campaignId, origin } = await req.json();
    if (!campaignId) return json({ error: "campaignId required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: campaign } = await admin
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();
    if (!campaign || campaign.status !== "draft") {
      return json({ error: "Campaign not found or already sent" }, 400);
    }

    await admin.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId);

    const { data: recipients } = await admin.rpc("admin_get_campaign_recipients", {
      p_audience: campaign.audience,
    });
    const list = (recipients ?? []) as { user_id: string; email: string }[];

    const siteOrigin = origin ?? Deno.env.get("SITE_ORIGIN") ?? "https://syncmenu.vercel.app";
    const secret = Deno.env.get("UNSUBSCRIBE_SECRET") ?? Deno.env.get("SMTP2GO_API_KEY") ?? "syncmenu";
    let sent = 0;

    const batchSize = 50;
    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (r) => {
          try {
            const footer = unsubscribeFooter(siteOrigin, r.user_id, secret);
            await sendEmail({
              to: r.email,
              subject: campaign.subject,
              html: campaign.body_html + footer,
            });
            sent++;
          } catch (e) {
            console.error(`Failed to send to ${r.email}`, e);
          }
        })
      );
    }

    await admin.from("email_campaigns").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipient_count: sent,
      sent_by: user.id,
    }).eq("id", campaignId);

    await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: "send_campaign",
      target_type: "email_campaign",
      target_id: campaignId,
      metadata: { recipient_count: sent },
    });

    return json({ ok: true, sent });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
