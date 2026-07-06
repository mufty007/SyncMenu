import { supabase } from "../../lib/supabase";

const SMTP2GO_URL = "https://api.smtp2go.com/v3/email/send";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = Deno.env.get("SMTP2GO_API_KEY");
  const sender = Deno.env.get("SMTP2GO_SENDER");
  if (!apiKey || !sender) {
    throw new Error("SMTP2GO_API_KEY and SMTP2GO_SENDER must be set");
  }

  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  const res = await fetch(SMTP2GO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      sender,
      to: recipients,
      subject: opts.subject,
      html_body: opts.html,
      text_body: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.data?.error ?? body?.error ?? `SMTP2Go error ${res.status}`);
  }
}

export function welcomeEmailHtml(origin: string): string {
  return `
    <div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933">
      <h1 style="color:#FF6B2C;font-size:24px">Welcome to SyncMenu</h1>
      <p>Your digital menu board is ready to set up. Here's how to go live in minutes:</p>
      <ol>
        <li>Finish your restaurant profile</li>
        <li>Create your first menu</li>
        <li>Open <a href="${origin}/play">syncmenu.app/play</a> on your TV and pair it</li>
      </ol>
      <p><a href="${origin}/app/menus" style="background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Open your dashboard</a></p>
      <p style="color:#52606D;font-size:13px;margin-top:32px">Questions? Reply to this email — we're here to help.</p>
    </div>
  `;
}

export function unsubscribeFooter(origin: string, userId: string, secret: string): string {
  const token = btoa(`${userId}:${hmacToken(userId, secret)}`);
  return `<p style="color:#9AA5B1;font-size:12px;margin-top:32px"><a href="${origin}/unsubscribe?token=${encodeURIComponent(token)}">Unsubscribe</a> from platform announcements.</p>`;
}

function hmacToken(userId: string, secret: string): string {
  // Simple deterministic token for unsubscribe links (not a full HMAC — edge function verifies)
  let hash = 0;
  const s = `${userId}:${secret}`;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

export function verifyUnsubscribeToken(userId: string, tokenPart: string, secret: string): boolean {
  return hmacToken(userId, secret) === tokenPart;
}

export function parseUnsubscribeToken(token: string): { userId: string; sig: string } | null {
  try {
    const decoded = atob(token);
    const [userId, sig] = decoded.split(":");
    if (!userId || !sig) return null;
    return { userId, sig };
  } catch {
    return null;
  }
}
