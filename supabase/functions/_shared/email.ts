import { createClient } from "npm:@supabase/supabase-js@2";

const SMTP2GO_URL = "https://api.smtp2go.com/v3/email/send";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailConfig {
  apiKey: string;
  sender: string;
  siteOrigin: string;
  unsubscribeSecret: string;
  welcomeSubject: string;
  welcomeHtml: string | null;
  welcomeEnabled: boolean;
  replyTo: string | null;
}

let cachedConfig: EmailConfig | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

const DEFAULT_WELCOME_HTML = (origin: string) => `
  <div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933">
    <h1 style="color:#FF6B2C;font-size:24px">Welcome to SyncMenu</h1>
    <p>Your digital menu board is ready to set up. Here's how to go live in minutes:</p>
    <ol>
      <li>Finish your restaurant profile</li>
      <li>Create your first menu</li>
      <li>Open <a href="${origin}/play">SyncMenu Play</a> on your TV and pair it</li>
    </ol>
    <p><a href="${origin}/app/menus" style="background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Open your dashboard</a></p>
    <p style="color:#52606D;font-size:13px;margin-top:32px">Questions? Reply to this email — we're here to help.</p>
  </div>
`;

function configFromEnv(): EmailConfig | null {
  const apiKey = Deno.env.get("SMTP2GO_API_KEY");
  const sender = Deno.env.get("SMTP2GO_SENDER");
  if (!apiKey || !sender) return null;
  const siteOrigin = Deno.env.get("SITE_ORIGIN") ?? "https://syncmenuapp.com";
  return {
    apiKey,
    sender,
    siteOrigin,
    unsubscribeSecret: Deno.env.get("UNSUBSCRIBE_SECRET") ?? apiKey,
    welcomeSubject: "Welcome to SyncMenu — let's get your menu live",
    welcomeHtml: null,
    welcomeEnabled: true,
    replyTo: null,
  };
}

function configFromDbRow(email: Record<string, unknown>, siteUrl: string): EmailConfig | null {
  const apiKey = email.smtp_api_key as string | undefined;
  const sender = email.smtp_sender as string | undefined;
  if (!apiKey || !sender) return null;
  const siteOrigin = (email.site_origin as string) || siteUrl || "https://syncmenuapp.com";
  return {
    apiKey,
    sender,
    siteOrigin,
    unsubscribeSecret: (email.unsubscribe_secret as string) || apiKey,
    welcomeSubject: (email.welcome_subject as string) || "Welcome to SyncMenu — let's get your menu live",
    welcomeHtml: (email.welcome_html as string) || null,
    welcomeEnabled: email.welcome_enabled !== false,
    replyTo: (email.reply_to as string) || null,
  };
}

/** Load SMTP config from env vars or platform_settings (set in super-admin console). */
export async function loadEmailConfig(): Promise<EmailConfig | null> {
  if (cachedConfig && Date.now() - cacheAt < CACHE_MS) return cachedConfig;

  const fromEnv = configFromEnv();
  if (fromEnv) {
    cachedConfig = fromEnv;
    cacheAt = Date.now();
    return fromEnv;
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await admin.from("platform_settings").select("config").eq("id", 1).maybeSingle();
  const config = (data?.config ?? {}) as Record<string, unknown>;
  const email = (config.email ?? {}) as Record<string, unknown>;
  const fromDb = configFromDbRow(email, config.site_url as string);
  if (fromDb) {
    cachedConfig = fromDb;
    cacheAt = Date.now();
    return fromDb;
  }
  return null;
}

export function clearEmailConfigCache() {
  cachedConfig = null;
  cacheAt = 0;
}

export async function sendEmail(opts: SendEmailOptions, config?: EmailConfig): Promise<void> {
  const cfg = config ?? await loadEmailConfig();
  if (!cfg) {
    throw new Error(
      "Email not configured — set SMTP in Platform → Emails → Setup or add Supabase secrets."
    );
  }

  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  const payload: Record<string, unknown> = {
    api_key: cfg.apiKey,
    sender: cfg.sender,
    to: recipients,
    subject: opts.subject,
    html_body: opts.html,
    text_body: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
  };
  if (cfg.replyTo) payload.custom_headers = [{ header: "Reply-To", value: cfg.replyTo }];

  const res = await fetch(SMTP2GO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.data?.error ?? body?.error ?? `SMTP2Go error ${res.status}`);
  }
}

export function welcomeEmailHtml(origin: string, config?: EmailConfig | null): string {
  if (config?.welcomeHtml) return config.welcomeHtml.replaceAll("{{origin}}", origin);
  return DEFAULT_WELCOME_HTML(origin);
}

export function unsubscribeFooter(origin: string, userId: string, secret: string): string {
  const token = btoa(`${userId}:${hmacToken(userId, secret)}`);
  return `<p style="color:#9AA5B1;font-size:12px;margin-top:32px"><a href="${origin}/unsubscribe?token=${encodeURIComponent(token)}">Unsubscribe</a> from platform announcements.</p>`;
}

function hmacToken(userId: string, secret: string): string {
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
