import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { trialDaysLeft } from "./format";
import { usePlatformSettings } from "./usePlatformSettings";
import { supabase } from "./supabase";
import { PLAN_LIMITS, type Subscription } from "./types";
import type { PlanLimitConfig } from "./platformConfig";

export interface EffectivePlanLimits {
  screens: number;
  menus: number;
  planId: string | null;
  onTrial: boolean;
}

export function limitsForPlan(
  planId: string | null | undefined,
  onTrial: boolean,
  planLimits: Record<string, PlanLimitConfig>
): EffectivePlanLimits {
  const active = planId && planLimits[planId];
  if (active) {
    return { screens: active.screens, menus: active.menus, planId, onTrial: false };
  }
  if (onTrial) {
    const trial = planLimits.trial ?? { screens: 5, menus: 10 };
    return { screens: trial.screens, menus: trial.menus, planId: null, onTrial: true };
  }
  return {
    screens: planLimits.trial?.screens ?? PLAN_LIMITS.screens,
    menus: planLimits.trial?.menus ?? PLAN_LIMITS.menus,
    planId: null,
    onTrial: false,
  };
}

/** Screen/menu caps for the current restaurant (subscription or trial). */
export function usePlanLimits(): EffectivePlanLimits {
  const { restaurant } = useAuth();
  const { config } = usePlatformSettings();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [dbLimits, setDbLimits] = useState<{ screens: number; menus: number } | null>(null);

  useEffect(() => {
    if (!restaurant) {
      setSub(null);
      setDbLimits(null);
      return;
    }
    void Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .maybeSingle(),
      supabase.rpc("restaurant_plan_limits", { p_restaurant_id: restaurant.id }),
    ]).then(([subRes, limitsRes]) => {
      setSub((subRes.data as Subscription) ?? null);
      const limits = limitsRes.data as { screens: number; menus: number } | null;
      setDbLimits(limits);
    });
  }, [restaurant]);

  const subscribed = sub?.status === "active" || sub?.status === "trialing";
  const onTrial =
    Boolean(restaurant) &&
    trialDaysLeft(restaurant!.trial_ends_at) > 0 &&
    !subscribed;

  const fallback = limitsForPlan(subscribed ? sub?.plan_id : null, onTrial, config.plan_limits);

  if (dbLimits) {
    return {
      screens: dbLimits.screens,
      menus: dbLimits.menus,
      planId: fallback.planId,
      onTrial: fallback.onTrial,
    };
  }

  return fallback;
}
