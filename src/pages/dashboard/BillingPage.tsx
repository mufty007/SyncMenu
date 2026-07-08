import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ExternalLink } from "lucide-react";
import BillingIntervalToggle from "../../components/BillingIntervalToggle";
import { supabase } from "../../lib/supabase";
import {
  isValidPlanId,
  parseBillingParams,
  type BillingInterval,
} from "../../lib/billingParams";
import { useAuth } from "../../context/AuthContext";
import { trialDaysLeft } from "../../lib/format";
import { usePlatformSettings } from "../../lib/usePlatformSettings";
import type { Subscription } from "../../lib/types";

export default function BillingPage() {
  const { restaurant } = useAuth();
  const { plans } = usePlatformSettings();
  const [params, setParams] = useSearchParams();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loaded, setLoaded] = useState(false);
  const billingFromUrl = parseBillingParams(params);
  const [interval, setInterval_] = useState<BillingInterval>(billingFromUrl.interval);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoCheckoutStarted = useRef(false);

  const daysLeft = restaurant ? trialDaysLeft(restaurant.trial_ends_at) : 0;
  const justSucceeded = params.get("success") === "1";

  useEffect(() => {
    setInterval_(billingFromUrl.interval);
  }, [billingFromUrl.interval]);

  useEffect(() => {
    if (!restaurant) return;
    supabase
      .from("subscriptions")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .maybeSingle()
      .then(({ data }) => {
        setSub((data as Subscription) ?? null);
        setLoaded(true);
      });
  }, [restaurant, justSucceeded]);

  const active = sub?.status === "active" || sub?.status === "trialing";

  async function subscribe(plan: string) {
    setBusyPlan(plan);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("create-checkout-session", {
      body: { plan, interval, origin: window.location.origin },
    });
    setBusyPlan(null);
    if (err || !data?.url) {
      setError(
        (data as { error?: string } | null)?.error ??
          "Couldn't start checkout — is the billing backend deployed? (See README → Stripe.)"
      );
      return;
    }
    window.location.href = data.url as string;
  }

  useEffect(() => {
    if (!loaded || active || autoCheckoutStarted.current) return;
    if (!billingFromUrl.checkout || !billingFromUrl.plan) return;
    if (!isValidPlanId(billingFromUrl.plan)) return;

    autoCheckoutStarted.current = true;
    const next = new URLSearchParams(params);
    next.delete("checkout");
    setParams(next, { replace: true });
    void subscribe(billingFromUrl.plan);
  }, [loaded, active, billingFromUrl.checkout, billingFromUrl.plan, params, setParams, interval]);

  function handleIntervalChange(next: BillingInterval) {
    setInterval_(next);
    const nextParams = new URLSearchParams(params);
    nextParams.set("interval", next);
    setParams(nextParams, { replace: true });
  }

  async function openPortal() {
    setBusyPlan("portal");
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("customer-portal", {
      body: { origin: window.location.origin },
    });
    setBusyPlan(null);
    if (err || !data?.url) {
      setError((data as { error?: string } | null)?.error ?? "Couldn't open the billing portal.");
      return;
    }
    window.location.href = data.url as string;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="mt-1 text-sm text-smoke">
            Every feature on every plan — pick by how many screens you run.
          </p>
        </div>
        {active && (
          <button className="btn-primary" onClick={() => void openPortal()} disabled={busyPlan !== null}>
            <ExternalLink size={15} />
            {busyPlan === "portal" ? "Opening…" : "Manage billing"}
          </button>
        )}
      </div>

      {justSucceeded && (
        <div className="mt-6 rounded-xl border border-live/30 bg-live/10 p-4 text-sm">
          <strong>Payment successful!</strong> Your subscription is active — it
          may take a few seconds to show below while Stripe confirms.
        </div>
      )}
      {params.get("canceled") === "1" && !active && (
        <div className="mt-6 rounded-xl bg-cloud p-4 text-sm text-smoke">
          Checkout canceled — no charge was made.
        </div>
      )}

      <div className="mt-6 rounded-xl bg-cloud p-4 text-sm">
        {active ? (
          <p>
            You're on <strong className="capitalize">{sub?.plan_id ?? "a paid"}</strong> —{" "}
            {sub?.status === "trialing" ? "trial via Stripe" : "active"}
            {sub?.current_period_end &&
              `, renews ${new Date(sub.current_period_end).toLocaleDateString()}`}
            . Change plan, update card, or cancel via <em>Manage billing</em>.
          </p>
        ) : daysLeft > 0 ? (
          <p>
            You're on the <strong>free trial</strong> with Growth features —{" "}
            {daysLeft} day{daysLeft === 1 ? "" : "s"} remaining. Subscribe below
            to keep your screens live after it ends.
          </p>
        ) : (
          <p className="text-alert">
            Your trial has ended — subscribe below to keep your screens live.
          </p>
        )}
      </div>

      {!active && loaded && (
        <BillingIntervalToggle value={interval} onChange={handleIntervalChange} className="mt-6" />
      )}

      {error && <p className="mt-4 text-sm text-alert">{error}</p>}

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = active && sub?.plan_id === plan.id;
          const price = interval === "yearly" ? plan.annualMonthly : plan.monthly;
          return (
            <div
              key={plan.id}
              className={`card relative p-6 ${
                isCurrent || (!active && plan.popular) ? "border-brand ring-2 ring-brand" : ""
              }`}
            >
              {isCurrent ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-live px-3.5 py-1 text-xs font-semibold text-white">
                  Current plan
                </span>
              ) : (
                !active &&
                plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )
              )}
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-0.5 text-sm text-smoke">{plan.tagline}</p>
              <p className="mt-4">
                <span className="font-display text-3xl font-bold">${price}</span>
                <span className="text-sm text-smoke">/month</span>
              </p>
              <p className="mt-0.5 text-xs text-smoke">
                {interval === "yearly"
                  ? `billed annually ($${plan.annualMonthly * 12}/yr)`
                  : `or ~$${plan.annualMonthly}/mo billed annually`}
              </p>
              <ul className="mt-5 space-y-2.5">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5 text-sm">
                    <Check size={15} className="shrink-0 text-live" /> {perk}
                  </li>
                ))}
              </ul>
              {active ? (
                <button
                  className="btn-secondary mt-6 w-full"
                  onClick={() => void openPortal()}
                  disabled={busyPlan !== null || isCurrent}
                >
                  {isCurrent ? "Your plan" : "Switch via portal"}
                </button>
              ) : (
                <button
                  className={`${plan.popular ? "btn-primary" : "btn-secondary"} mt-6 w-full`}
                  onClick={() => void subscribe(plan.id)}
                  disabled={busyPlan !== null}
                >
                  {busyPlan === plan.id ? "Starting checkout…" : "Subscribe"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-smoke">
        Test mode: use card 4242 4242 4242 4242, any future expiry, any CVC.
      </p>
    </div>
  );
}
