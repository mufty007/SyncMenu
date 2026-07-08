export const EMAIL_AUDIENCES = [
  { id: "all", label: "All opted-in owners" },
  { id: "active", label: "Active (trial or subscribed)" },
  { id: "trial", label: "On trial only" },
  { id: "subscribed", label: "Paying subscribers" },
  { id: "churned", label: "Churned (trial ended, no sub)" },
] as const;

export type EmailAudience = (typeof EMAIL_AUDIENCES)[number]["id"];

export interface Campaign {
  id: string;
  subject: string;
  body_html?: string;
  audience: string;
  status: string;
  sent_at: string | null;
  recipient_count: number | null;
  created_at: string;
}

export interface EmailSettings {
  smtp_api_key_masked: string | null;
  smtp_api_key_set: boolean;
  smtp_sender: string;
  site_origin: string;
  unsubscribe_secret_set: boolean;
  welcome_subject: string;
  welcome_html: string | null;
  welcome_enabled: boolean;
  reply_to: string;
}

export interface EmailRecipient {
  user_id: string;
  email: string;
  restaurant_name: string;
  restaurant_status: string;
  marketing_opt_in: boolean;
  unsubscribed_at: string | null;
  plan_id: string | null;
  subscription_status: string | null;
}

export interface EmailStats {
  total_owners: number;
  opted_in: number;
  unsubscribed: number;
  campaigns_sent: number;
  drafts: number;
}

export type EmailTab = "recipients" | "compose" | "setup" | "history";
