import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/stripe.ts";
import { sendEmail, welcomeEmailHtml } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, userId, origin } = await req.json();
    if (!email) return json({ error: "email required" }, 400);

    const siteOrigin = origin ?? Deno.env.get("SITE_ORIGIN") ?? "https://syncmenu.vercel.app";
    await sendEmail({
      to: email,
      subject: "Welcome to SyncMenu — let's get your menu live",
      html: welcomeEmailHtml(siteOrigin),
    });

    if (userId) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await admin.from("email_preferences").upsert({
        user_id: userId,
        marketing_opt_in: true,
        updated_at: new Date().toISOString(),
      });
    }

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
