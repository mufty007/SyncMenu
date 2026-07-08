import { PLANS, type Plan } from "./types";

export interface PlanLimitConfig {
  screens: number;
  menus: number;
}

export interface PlanPricingConfig {
  monthly: number;
  annualMonthly: number;
}

export interface PlatformConfig {
  trial_days: number;
  max_admins: number;
  support_email: string;
  site_url: string;
  plan_limits: Record<string, PlanLimitConfig>;
  pricing: Record<string, PlanPricingConfig>;
}

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  trial_days: 14,
  max_admins: 3,
  support_email: "support@syncmenuapp.com",
  site_url: "https://syncmenuapp.com",
  plan_limits: {
    trial: { screens: 5, menus: 10 },
    starter: { screens: 1, menus: 5 },
    growth: { screens: 5, menus: 10 },
    pro: { screens: 10, menus: 999 },
  },
  pricing: {
    starter: { monthly: 15, annualMonthly: 12 },
    growth: { monthly: 30, annualMonthly: 25 },
    pro: { monthly: 99, annualMonthly: 82 },
  },
};

export function mergePlatformConfig(raw: unknown): PlatformConfig {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<PlatformConfig>;
  return {
    trial_days: data.trial_days ?? DEFAULT_PLATFORM_CONFIG.trial_days,
    max_admins: data.max_admins ?? DEFAULT_PLATFORM_CONFIG.max_admins,
    support_email: data.support_email ?? DEFAULT_PLATFORM_CONFIG.support_email,
    site_url: data.site_url ?? DEFAULT_PLATFORM_CONFIG.site_url,
    plan_limits: {
      ...DEFAULT_PLATFORM_CONFIG.plan_limits,
      ...(data.plan_limits ?? {}),
    },
    pricing: {
      ...DEFAULT_PLATFORM_CONFIG.pricing,
      ...(data.pricing ?? {}),
    },
  };
}

/** Merge DB pricing into static plan metadata (names, perks, etc.). */
export function plansFromConfig(config: PlatformConfig): Plan[] {
  return PLANS.map((plan) => ({
    ...plan,
    monthly: config.pricing[plan.id]?.monthly ?? plan.monthly,
    annualMonthly: config.pricing[plan.id]?.annualMonthly ?? plan.annualMonthly,
    perks: perksFromLimits(plan, config.plan_limits[plan.id]),
  }));
}

function perksFromLimits(plan: Plan, limits?: PlanLimitConfig): string[] {
  if (!limits) return plan.perks;
  return plan.perks.map((perk) => {
    if (perk.match(/^\d+ screen/i)) {
      return limits.screens === 1 ? "1 screen" : `Up to ${limits.screens} screens`;
    }
    if (perk.match(/saved menus/i)) {
      return limits.menus >= 999 ? "Unlimited saved menus" : `${limits.menus} saved menus`;
    }
    return perk;
  });
}
