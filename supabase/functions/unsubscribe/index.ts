import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/stripe.ts";
import { parseUnsubscribeToken, verifyUnsubscribeToken } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) return json({ error: "token required" }, 400);

    const parsed = parseUnsubscribeToken(token);
    if (!parsed) return json({ error: "Invalid token" }, 400);

    const secret = Deno.env.get("UNSUBSCRIBE_SECRET") ?? Deno.env.get("SMTP2GO_API_KEY") ?? "syncmenu";
    if (!verifyUnsubscribeToken(parsed.userId, parsed.sig, secret)) {
      return json({ error: "Invalid token" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await admin.rpc("unsubscribe_marketing", { p_user_id: parsed.userId });

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
