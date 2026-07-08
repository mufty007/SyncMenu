import { createClient } from "npm:@supabase/supabase-js@2";

const SMTP2GO_URL = "https://api.smtp2go.com/v3/email/send";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface AutomationDef {
  enabled: boolean;
  subject: string;
  html: string;
  days_before?: number;
}

export interface EmailConfig {
  apiKey: string;
  sender: string;
  siteOrigin: string;
  unsubscribeSecret: string;
  replyTo: string | null;
  automations: Record<string, AutomationDef>;
  /** @deprecated use automations.welcome */
  welcomeSubject: string;
  /** @deprecated use automations.welcome */
  welcomeHtml: string | null;
  /** @deprecated use automations.welcome */
  welcomeEnabled: boolean;
}

export interface InlineEmailConfig {
  smtp_api_key?: string;
  smtp_sender?: string;
  site_origin?: string;
  unsubscribe_secret?: string;
  reply_to?: string;
}

let cachedConfig: EmailConfig | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

function parseAutomations(email: Record<string, unknown>): Record<string, AutomationDef> {
  const raw = email.automations as Record<string, Record<string, unknown>> | undefined;
  if (!raw) return {};
  const out: Record<string, AutomationDef> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!val) continue;
    out[key] = {
      enabled: val.enabled !== false,
      subject: (val.subject as string) || "",
      html: (val.html as string) || "",
      days_before: typeof val.days_before === "number" ? val.days_before : undefined,
    };
  }
  return out;
}

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
    replyTo: null,
    automations: {},
    welcomeSubject: "Welcome to SyncMenu — let's get your menu live",
    welcomeHtml: null,
    welcomeEnabled: true,
  };
}

function configFromDbRow(email: Record<string, unknown>, siteUrl: string): EmailConfig | null {
  const apiKey = email.smtp_api_key as string | undefined;
  const sender = email.smtp_sender as string | undefined;
  if (!apiKey || !sender) return null;
  const siteOrigin = (email.site_origin as string) || siteUrl || "https://syncmenuapp.com";
  const automations = parseAutomations(email);
  const welcome = automations.welcome;
  return {
    apiKey,
    sender,
    siteOrigin,
    unsubscribeSecret: (email.unsubscribe_secret as string) || apiKey,
    replyTo: (email.reply_to as string) || null,
    automations,
    welcomeSubject:
      welcome?.subject ||
      (email.welcome_subject as string) ||
      "Welcome to SyncMenu — let's get your menu live",
    welcomeHtml: welcome?.html || (email.welcome_html as string) || null,
    welcomeEnabled: welcome ? welcome.enabled : email.welcome_enabled !== false,
  };
}

/** Build config from inline form values (Setup tab test-before-save). */
export function configFromInline(
  inline: InlineEmailConfig,
  fallback?: EmailConfig | null
): EmailConfig | null {
  const apiKey = inline.smtp_api_key || fallback?.apiKey;
  const sender = inline.smtp_sender || fallback?.sender;
  if (!apiKey || !sender) return null;
  return {
    apiKey,
    sender,
    siteOrigin: inline.site_origin || fallback?.siteOrigin || "https://syncmenuapp.com",
    unsubscribeSecret:
      inline.unsubscribe_secret || fallback?.unsubscribeSecret || apiKey,
    replyTo: inline.reply_to ?? fallback?.replyTo ?? null,
    automations: fallback?.automations ?? {},
    welcomeSubject: fallback?.welcomeSubject ?? "Welcome to SyncMenu — let's get your menu live",
    welcomeHtml: fallback?.welcomeHtml ?? null,
    welcomeEnabled: fallback?.welcomeEnabled ?? true,
  };
}

/** Load SMTP config — DB (platform_settings) wins when complete; env is fallback only. */
export async function loadEmailConfig(): Promise<EmailConfig | null> {
  if (cachedConfig && Date.now() - cacheAt < CACHE_MS) return cachedConfig;

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

  const fromEnv = configFromEnv();
  if (fromEnv) {
    cachedConfig = fromEnv;
    cacheAt = Date.now();
    return fromEnv;
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
  const html = config?.welcomeHtml ?? config?.automations?.welcome?.html;
  if (html) return html.replaceAll("{{origin}}", origin);
  return `<div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933">
    <h1 style="color:#FF6B2C;font-size:24px">Welcome to SyncMenu</h1>
    <p>Your digital menu board is ready to set up.</p>
    <p><a href="${origin}/app/menus" style="background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Open your dashboard</a></p>
  </div>`;
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
