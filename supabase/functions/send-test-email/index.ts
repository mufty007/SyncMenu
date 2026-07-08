import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/stripe.ts";
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

    const { to, subject, html } = await req.json();
    const recipient = (to as string) || user.email;
    if (!recipient) return json({ error: "No recipient" }, 400);

    const config = await loadEmailConfig();
    if (!config) return json({ error: "Email not configured — complete Setup first." }, 400);

    await sendEmail(
      {
        to: recipient,
        subject: subject || "SyncMenu test email",
        html:
          html ||
          `<p>This is a test email from your SyncMenu platform console.</p><p>SMTP is working.</p>`,
      },
      config
    );

    return json({ ok: true, sent_to: recipient });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
