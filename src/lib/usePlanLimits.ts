import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { trialDaysLeft } from "./format";
import { supabase } from "./supabase";
import {
  PLAN_LIMITS,
  PLAN_LIMITS_BY_PLAN,
  type Subscription,
} from "./types";

export interface EffectivePlanLimits {
  screens: number;
  menus: number;
  planId: string | null;
  onTrial: boolean;
}

export function limitsForPlan(
  planId: string | null | undefined,
  onTrial: boolean
): EffectivePlanLimits {
  const active = planId && PLAN_LIMITS_BY_PLAN[planId];
  if (active) {
    return { screens: active.screens, menus: active.menus, planId, onTrial: false };
  }
  if (onTrial) {
    const trial = PLAN_LIMITS_BY_PLAN.trial;
    return { screens: trial.screens, menus: trial.menus, planId: null, onTrial: true };
  }
  return {
    screens: PLAN_LIMITS.screens,
    menus: PLAN_LIMITS.menus,
    planId: null,
    onTrial: false,
  };
}

/** Screen/menu caps for the current restaurant (subscription or trial). */
export function usePlanLimits(): EffectivePlanLimits {
  const { restaurant } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    if (!restaurant) {
      setSub(null);
      return;
    }
    void supabase
      .from("subscriptions")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()
      .then(({ data }) => setSub((data as Subscription) ?? null));
  }, [restaurant]);

  const subscribed =
    sub?.status === "active" || sub?.status === "trialing";
  const onTrial =
    Boolean(restaurant) &&
    trialDaysLeft(restaurant!.trial_ends_at) > 0 &&
    !subscribed;

  return limitsForPlan(subscribed ? sub?.plan_id : null, onTrial);
}
