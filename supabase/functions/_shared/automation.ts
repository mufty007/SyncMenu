import { createClient } from "npm:@supabase/supabase-js@2";
import { loadEmailConfig, sendEmail, type EmailConfig } from "./email.ts";

export interface AutomationDef {
  enabled: boolean;
  subject: string;
  html: string;
  days_before?: number;
}

export type AutomationVars = Record<string, string>;

export function renderTemplate(template: string, vars: AutomationVars): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

function getAutomation(config: EmailConfig, key: string): AutomationDef | null {
  const auto = config.automations?.[key];
  if (!auto || !auto.enabled) return null;
  if (!auto.subject || !auto.html) return null;
  return auto;
}

/** Send a transactional automation email (deduped via email_automation_log). */
export async function sendAutomation(
  key: string,
  opts: {
    userId: string;
    restaurantId: string;
    email: string;
    vars: AutomationVars;
    skipLog?: boolean;
  }
): Promise<boolean> {
  const config = await loadEmailConfig();
  if (!config) {
    console.error("sendAutomation: email not configured");
    return false;
  }

  const automation = getAutomation(config, key);
  if (!automation) return false;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (!opts.skipLog) {
    const { data: existing } = await admin
      .from("email_automation_log")
      .select("id")
      .eq("restaurant_id", opts.restaurantId)
      .eq("automation_key", key)
      .maybeSingle();
    if (existing) return false;
  }

  const vars = {
    origin: config.siteOrigin,
    billing_url: `${config.siteOrigin}/app/billing`,
    ...opts.vars,
  };

  const subject = renderTemplate(automation.subject, vars);
  const html = renderTemplate(automation.html, vars);

  await sendEmail({ to: opts.email, subject, html }, config);

  if (!opts.skipLog) {
    await admin.from("email_automation_log").insert({
      user_id: opts.userId,
      restaurant_id: opts.restaurantId,
      automation_key: key,
    });
  }

  return true;
}

/** Process rows from email_automation_queue. */
export async function processAutomationQueue(): Promise<number> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: rows } = await admin
    .from("email_automation_queue")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(50);

  let sent = 0;
  for (const row of rows ?? []) {
    const { data: owner } = await admin
      .from("restaurants")
      .select("owner_id, name")
      .eq("id", row.restaurant_id)
      .single();
    if (!owner) continue;

    const { data: user } = await admin.auth.admin.getUserById(owner.owner_id);
    if (!user?.user?.email) continue;

    const vars = {
      ...(row.vars as Record<string, string>),
      restaurant_name: owner.name,
      owner_email: user.user.email,
    };

    try {
      const ok = await sendAutomation(row.automation_key, {
        userId: owner.owner_id,
        restaurantId: row.restaurant_id,
        email: user.user.email,
        vars,
      });
      if (ok) sent++;
    } catch (e) {
      console.error(`Queue automation ${row.automation_key} failed`, e);
    }

    await admin
      .from("email_automation_queue")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", row.id);
  }
  return sent;
}

/** Daily trial-ending / trial-expired checks. */
export async function processTrialAutomations(): Promise<number> {
  const config = await loadEmailConfig();
  if (!config) return 0;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const trialEnding = config.automations?.trial_ending;
  const trialExpired = config.automations?.trial_expired;
  const daysBefore = trialEnding?.days_before ?? 3;

  let sent = 0;

  const { data: restaurants } = await admin
    .from("restaurants")
    .select("id, name, owner_id, trial_ends_at, status")
    .eq("status", "active");

  for (const r of restaurants ?? []) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status")
      .eq("restaurant_id", r.id)
      .maybeSingle();
    if (sub?.status === "active" || sub?.status === "trialing") continue;

    const { data: user } = await admin.auth.admin.getUserById(r.owner_id);
    if (!user?.user?.email) continue;

    const trialEnd = new Date(r.trial_ends_at);
    const now = new Date();
    const msLeft = trialEnd.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    const vars = {
      restaurant_name: r.name,
      owner_email: user.user.email,
      trial_days_left: String(Math.max(daysLeft, 0)),
    };

    if (trialEnding?.enabled && daysLeft > 0 && daysLeft <= daysBefore) {
      try {
        if (
          await sendAutomation("trial_ending", {
            userId: r.owner_id,
            restaurantId: r.id,
            email: user.user.email,
            vars,
          })
        ) {
          sent++;
        }
      } catch (e) {
        console.error("trial_ending failed", e);
      }
    }

    if (trialExpired?.enabled && daysLeft <= 0) {
      try {
        if (
          await sendAutomation("trial_expired", {
            userId: r.owner_id,
            restaurantId: r.id,
            email: user.user.email,
            vars,
          })
        ) {
          sent++;
        }
      } catch (e) {
        console.error("trial_expired failed", e);
      }
    }
  }

  return sent;
}
