/** Default automation templates — keep in sync with 0010_email_automations.sql */

export interface AutomationTemplate {
  enabled: boolean;
  subject: string;
  html: string;
  days_before?: number;
  description: string;
}

export const AUTOMATION_KEYS = [
  "welcome",
  "trial_ending",
  "trial_expired",
  "subscription_confirmed",
  "payment_failed",
  "account_suspended",
] as const;

export type AutomationKey = (typeof AUTOMATION_KEYS)[number];

export const AUTOMATION_LABELS: Record<AutomationKey, string> = {
  welcome: "Welcome on signup",
  trial_ending: "Trial ending soon",
  trial_expired: "Trial expired",
  subscription_confirmed: "Subscription confirmed",
  payment_failed: "Payment failed",
  account_suspended: "Account suspended",
};

const wrap = (body: string) =>
  `<div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933">${body}</div>`;

const btn = (href: string, label: string) =>
  `<p><a href="${href}" style="background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">${label}</a></p>`;

export const DEFAULT_AUTOMATIONS: Record<AutomationKey, AutomationTemplate> = {
  welcome: {
    enabled: true,
    description: "Sent when a new owner signs up.",
    subject: "Welcome to SyncMenu — let's get your menu live",
    html: wrap(`
      <h1 style="color:#FF6B2C;font-size:24px">Welcome to SyncMenu</h1>
      <p>Hi — your digital menu board is ready to set up. Here's how to go live in minutes:</p>
      <ol>
        <li>Finish your restaurant profile</li>
        <li>Create your first menu</li>
        <li>Open <a href="{{origin}}/play">SyncMenu Play</a> on your TV and pair it</li>
      </ol>
      ${btn("{{origin}}/app/menus", "Open your dashboard")}
      <p style="color:#52606D;font-size:13px;margin-top:32px">Questions? Reply to this email — we're here to help.</p>
    `),
  },
  trial_ending: {
    enabled: true,
    days_before: 3,
    description: "Sent when a trial has 3 days or fewer remaining.",
    subject: "Your SyncMenu trial ends in {{trial_days_left}} days",
    html: wrap(`
      <h1 style="color:#FF6B2C;font-size:22px">Your trial is ending soon</h1>
      <p><strong>{{restaurant_name}}</strong> has <strong>{{trial_days_left}} day(s)</strong> left on your free trial.</p>
      <p>Subscribe now to keep your screens live — every feature stays on every plan.</p>
      ${btn("{{billing_url}}", "Choose a plan")}
      <p style="color:#52606D;font-size:13px;margin-top:24px">Need help? Just reply to this email.</p>
    `),
  },
  trial_expired: {
    enabled: true,
    description: "Sent when a trial ends without a subscription.",
    subject: "Your SyncMenu trial has ended",
    html: wrap(`
      <h1 style="color:#FF6B2C;font-size:22px">Your trial has ended</h1>
      <p>Your menus for <strong>{{restaurant_name}}</strong> are paused until you subscribe.</p>
      <p>Pick a plan and your screens go live again in seconds.</p>
      ${btn("{{billing_url}}", "Subscribe now")}
    `),
  },
  subscription_confirmed: {
    enabled: true,
    description: "Sent after a successful Stripe subscription.",
    subject: "You're subscribed to SyncMenu {{plan_name}}",
    html: wrap(`
      <h1 style="color:#FF6B2C;font-size:22px">You're all set!</h1>
      <p>Thanks — <strong>{{restaurant_name}}</strong> is now on the <strong>{{plan_name}}</strong> plan.</p>
      <p>Your screens stay live. Manage billing anytime from your dashboard.</p>
      ${btn("{{billing_url}}", "Manage billing")}
    `),
  },
  payment_failed: {
    enabled: true,
    description: "Sent when Stripe reports a failed payment or past-due subscription.",
    subject: "Action needed — payment failed for SyncMenu",
    html: wrap(`
      <h1 style="color:#E5484D;font-size:22px">We couldn't process your payment</h1>
      <p>Your subscription for <strong>{{restaurant_name}}</strong> needs attention.</p>
      <p>Update your card to keep your menu boards live.</p>
      ${btn("{{billing_url}}", "Update payment method")}
    `),
  },
  account_suspended: {
    enabled: true,
    description: "Sent when a platform admin suspends the account.",
    subject: "Your SyncMenu account has been suspended",
    html: wrap(`
      <h1 style="color:#E5484D;font-size:22px">Account suspended</h1>
      <p>Your SyncMenu account for <strong>{{restaurant_name}}</strong> has been suspended.</p>
      <p>Your screens will not display until the account is restored. Contact support if you have questions.</p>
      <p style="color:#52606D;font-size:13px;margin-top:24px">Reply to this email for help.</p>
    `),
  },
};

export const SAMPLE_VARS: Record<string, string> = {
  origin: "https://syncmenuapp.com",
  restaurant_name: "Big Bite Chicken",
  owner_email: "owner@example.com",
  trial_days_left: "3",
  billing_url: "https://syncmenuapp.com/app/billing",
  plan_name: "Growth",
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}
