import { PLANS } from "./types";

export type BillingInterval = "monthly" | "yearly";

const BILLING_INTENT_KEY = "syncmenu_billing_intent";

export interface BillingIntent {
  plan?: string;
  interval: BillingInterval;
  checkout?: boolean;
  addon?: "clover";
}

export function isBillingInterval(value: string | null): value is BillingInterval {
  return value === "monthly" || value === "yearly";
}

export function isValidPlanId(plan: string | null): plan is string {
  return !!plan && PLANS.some((p) => p.id === plan);
}

export function parseBillingParams(search: URLSearchParams): BillingIntent {
  const interval = search.get("interval");
  const plan = search.get("plan");
  return {
    plan: isValidPlanId(plan) ? plan : undefined,
    interval: isBillingInterval(interval) ? interval : "monthly",
    checkout: search.get("checkout") === "1",
    addon: search.get("addon") === "clover" ? "clover" : undefined,
  };
}

export function buildBillingPath(intent: BillingIntent): string {
  const params = new URLSearchParams();
  if (intent.plan) params.set("plan", intent.plan);
  params.set("interval", intent.interval);
  if (intent.checkout) params.set("checkout", "1");
  if (intent.addon) params.set("addon", intent.addon);
  return `/app/billing?${params.toString()}`;
}

export function planCheckoutPath(
  planId: string,
  interval: BillingInterval,
  addon?: "clover"
): string {
  return buildBillingPath({ plan: planId, interval, checkout: true, addon });
}

export function saveBillingIntent(intent: BillingIntent): void {
  sessionStorage.setItem(BILLING_INTENT_KEY, JSON.stringify(intent));
}

export function readBillingIntent(): BillingIntent | null {
  try {
    const raw = sessionStorage.getItem(BILLING_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BillingIntent;
    if (!isBillingInterval(parsed.interval)) return null;
    return {
      plan: isValidPlanId(parsed.plan ?? null) ? parsed.plan : undefined,
      interval: parsed.interval,
      checkout: !!parsed.checkout,
      addon: parsed.addon === "clover" ? "clover" : undefined,
    };
  } catch {
    return null;
  }
}

export function clearBillingIntent(): void {
  sessionStorage.removeItem(BILLING_INTENT_KEY);
}
