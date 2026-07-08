import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/stripe.ts";
import {
  configFromInline,
  loadEmailConfig,
  sendEmail,
  type InlineEmailConfig,
} from "../_shared/email.ts";

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

    const body = await req.json();
    const {
      to,
      subject,
      html,
      smtp_api_key,
      smtp_sender,
      site_origin,
      unsubscribe_secret,
      reply_to,
      record_test,
    } = body as {
      to?: string;
      subject?: string;
      html?: string;
      smtp_api_key?: string;
      smtp_sender?: string;
      site_origin?: string;
      unsubscribe_secret?: string;
      reply_to?: string;
      record_test?: boolean;
    };

    const recipient = to || user.email;
    if (!recipient) return json({ error: "No recipient" }, 400);

    const saved = await loadEmailConfig();
    const inline: InlineEmailConfig = {
      smtp_api_key,
      smtp_sender,
      site_origin,
      unsubscribe_secret,
      reply_to,
    };
    const config =
      configFromInline(inline, saved) ?? saved;
    if (!config) {
      return json({ error: "Email not configured — enter SMTP key and sender." }, 400);
    }

    try {
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
    } catch (sendErr) {
      if (record_test) {
        await supabase.rpc("admin_record_email_test", { p_ok: false });
      }
      throw sendErr;
    }

    if (record_test) {
      await supabase.rpc("admin_record_email_test", { p_ok: true });
    }

    return json({ ok: true, sent_to: recipient });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
