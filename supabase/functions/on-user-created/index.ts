import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/stripe.ts";
import { sendAutomation } from "../_shared/automation.ts";
import { loadEmailConfig, sendEmail, welcomeEmailHtml } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, userId, origin, restaurantId } = await req.json();
    if (!email) return json({ error: "email required" }, 400);

    const config = await loadEmailConfig();
    if (!config) return json({ error: "Email not configured" }, 500);

    const siteOrigin = origin ?? config.siteOrigin;

    if (userId && restaurantId) {
      await sendAutomation("welcome", {
        userId,
        restaurantId,
        email,
        vars: { origin: siteOrigin, owner_email: email },
      });
    } else {
      // Fallback when restaurant not created yet — send without dedup log
      const welcome = config.automations?.welcome;
      if (!welcome?.enabled && !config.welcomeEnabled) {
        return json({ ok: true, skipped: true });
      }
      await sendEmail(
        {
          to: email,
          subject: welcome?.subject || config.welcomeSubject,
          html: welcomeEmailHtml(siteOrigin, config),
        },
        config
      );
    }

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
