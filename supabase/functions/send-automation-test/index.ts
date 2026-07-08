import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/stripe.ts";
import { renderTemplate } from "../_shared/automation.ts";
import { loadEmailConfig, sendEmail } from "../_shared/email.ts";

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
    if (!isAdmin) return json({ error: "Not authorized" }, 403);

    const { subject, html, vars } = await req.json();
    const recipient = user.email;
    if (!recipient) return json({ error: "No recipient" }, 400);
    if (!subject || !html) return json({ error: "subject and html required" }, 400);

    const config = await loadEmailConfig();
    if (!config) return json({ error: "Email not configured" }, 400);

    const merged = {
      origin: config.siteOrigin,
      billing_url: `${config.siteOrigin}/app/billing`,
      restaurant_name: "Big Bite Chicken",
      owner_email: recipient,
      trial_days_left: "3",
      plan_name: "Growth",
      ...(vars ?? {}),
    };

    await sendEmail(
      {
        to: recipient,
        subject: renderTemplate(subject, merged),
        html: renderTemplate(html, merged),
      },
      config
    );

    return json({ ok: true, sent_to: recipient });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
