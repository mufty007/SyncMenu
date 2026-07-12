import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarPlus,
  ExternalLink,
  Save,
  ShieldBan,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { stripeCustomerUrl } from "../../lib/stripeLinks";
import { StatusBadge } from "./ui";

interface TenantDetail {
  id: string;
  name: string;
  status: string;
  currency: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  trial_ends_at: string;
  created_at: string;
  owner_email: string;
  screen_count: number;
  menu_count: number;
  screen_limit_override: number | null;
  menu_limit_override: number | null;
  effective_limits: { screens: number; menus: number };
  subscription: {
    plan_id: string | null;
    status: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_end: string | null;
  } | null;
}

const PLANS = ["starter", "growth", "pro"] as const;

export default function TenantDetailPage() {
  const { id } = useParams();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(14);
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [trialEnd, setTrialEnd] = useState("");
  const [screenOverride, setScreenOverride] = useState("");
  const [menuOverride, setMenuOverride] = useState("");
  const [compPlan, setCompPlan] = useState("growth");
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.rpc("admin_get_tenant", { p_id: id });
    const t = data as TenantDetail;
    setTenant(t);
    if (t) {
      setName(t.name);
      setCurrency(t.currency);
      setTrialEnd(t.trial_ends_at.slice(0, 10));
      setScreenOverride(t.screen_limit_override?.toString() ?? "");
      setMenuOverride(t.menu_limit_override?.toString() ?? "");
      setCompPlan(t.subscription?.plan_id ?? "growth");
    }
  }

  useEffect(() => {
    if (id) void load();
  }, [id]);

  async function suspend(suspendAccount: boolean) {
    if (!tenant) return;
    if (suspendAccount && !confirm(`Suspend "${tenant.name}"? Their screens will stop displaying.`)) {
      return;
    }
    setBusy(true);
    await supabase.rpc("admin_suspend_tenant", {
      p_id: tenant.id,
      p_suspend: suspendAccount,
      p_reason: reason || null,
    });
    setReason("");
    setBusy(false);
    void load();
  }

  async function extendTrial() {
    if (!tenant) return;
    setBusy(true);
    await supabase.rpc("admin_extend_trial", { p_id: tenant.id, p_days: days });
    setBusy(false);
    void load();
  }

  async function saveTenant() {
    if (!tenant) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("admin_update_tenant", {
      p_id: tenant.id,
      p_name: name,
      p_currency: currency,
      p_trial_ends_at: trialEnd ? new Date(trialEnd).toISOString() : null,
      p_screen_limit_override: screenOverride ? Number(screenOverride) : null,
      p_menu_limit_override: menuOverride ? Number(menuOverride) : null,
      p_clear_limit_overrides: !screenOverride && !menuOverride,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Restaurant updated.");
    void load();
  }

  async function applyCompPlan() {
    if (!tenant) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_tenant_plan", {
      p_restaurant_id: tenant.id,
      p_plan_id: compPlan,
      p_status: "active",
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Plan set to ${compPlan} (comp / manual).`);
    void load();
  }

  async function clearSubscription() {
    if (!tenant || !confirm("Clear subscription record? Stripe billing is unchanged.")) return;
    setBusy(true);
    await supabase.rpc("admin_clear_tenant_subscription", {
      p_restaurant_id: tenant.id,
    });
    setBusy(false);
    void load();
  }

  if (!tenant) {
    return (
      <div>
        <Link to="/platform/tenants" className="btn-ghost -ml-3">
          <ArrowLeft size={16} /> All restaurants
        </Link>
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-mist/40" />
      </div>
    );
  }

  const suspended = tenant.status === "suspended";
  const stripeUrl = tenant.subscription?.stripe_customer_id
    ? stripeCustomerUrl(tenant.subscription.stripe_customer_id)
    : null;

  const rows: [string, React.ReactNode][] = [
    ["Status", <StatusBadge status={tenant.status} />],
    ["Owner", tenant.owner_email],
    ["Signed up", new Date(tenant.created_at).toLocaleDateString()],
    ["Trial ends", new Date(tenant.trial_ends_at).toLocaleDateString()],
    [
      "Screens / menus",
      `${tenant.screen_count} / ${tenant.menu_count} (limit ${tenant.effective_limits.screens} / ${tenant.effective_limits.menus})`,
    ],
    [
      "Subscription",
      <span className="inline-flex items-center gap-2">
        <StatusBadge status={tenant.subscription?.status ?? "none"} />
        {tenant.subscription?.plan_id && (
          <span className="text-xs capitalize text-smoke">{tenant.subscription.plan_id}</span>
        )}
      </span>,
    ],
  ];

  return (
    <div>
      <Link to="/platform/tenants" className="btn-ghost -ml-3">
        <ArrowLeft size={16} /> All restaurants
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <StatusBadge status={tenant.status} />
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-live/30 bg-live/10 p-3 text-sm">{message}</div>
      )}

      {suspended && (
        <div className="mt-4 rounded-xl border border-alert/30 bg-alert/5 p-4 text-sm">
          <p className="font-medium text-alert">Account suspended</p>
          <p className="mt-1 text-smoke">
            {tenant.suspended_reason || "No reason recorded."}
            {tenant.suspended_at &&
              ` — ${new Date(tenant.suspended_at).toLocaleString()}`}
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <dt className="text-smoke">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
          {stripeUrl && (
            <a
              href={stripeUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary mt-5 inline-flex"
            >
              <ExternalLink size={16} /> Open in Stripe
            </a>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold">Edit restaurant</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="label">Restaurant name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Currency</label>
              <input className="input w-28" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div>
              <label className="label">Trial end date</label>
              <input
                type="date"
                className="input"
                value={trialEnd}
                onChange={(e) => setTrialEnd(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Screen limit override</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  placeholder="Default"
                  value={screenOverride}
                  onChange={(e) => setScreenOverride(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Menu limit override</label>
                <input
                  type="number"
                  min={1}
                  className="input"
                  placeholder="Default"
                  value={menuOverride}
                  onChange={(e) => setMenuOverride(e.target.value)}
                />
              </div>
            </div>
            <button className="btn-primary" disabled={busy} onClick={() => void saveTenant()}>
              <Save size={16} /> Save restaurant
            </button>
          </div>

          <div className="mt-6 border-t border-mist pt-6">
            <label className="label">Comp / manual plan</label>
            <div className="flex flex-wrap gap-2">
              <select
                className="input max-w-[10rem]"
                value={compPlan}
                onChange={(e) => setCompPlan(e.target.value)}
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button className="btn-secondary" disabled={busy} onClick={() => void applyCompPlan()}>
                Set plan
              </button>
              <button className="btn-ghost text-smoke" disabled={busy} onClick={() => void clearSubscription()}>
                Clear sub record
              </button>
            </div>
            <p className="mt-1 text-xs text-smoke">
              Bypasses Stripe for comps. Does not charge or cancel in Stripe.
            </p>
          </div>

          <div className="mt-6 border-t border-mist pt-6">
            <label className="label">Extend trial</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={365}
                className="input w-24"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
              <span className="flex items-center text-sm text-smoke">days</span>
              <button
                className="btn-secondary ml-auto"
                disabled={busy}
                onClick={() => void extendTrial()}
              >
                <CalendarPlus size={16} /> Extend
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-mist pt-6">
            {suspended ? (
              <>
                <p className="text-sm text-smoke">
                  Restore this account so screens display again.
                </p>
                <button
                  className="btn-primary mt-3"
                  disabled={busy}
                  onClick={() => void suspend(false)}
                >
                  <ShieldCheck size={16} /> Unsuspend account
                </button>
              </>
            ) : (
              <>
                <label className="label text-alert">Suspend account</label>
                <input
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional) — non-payment, policy…"
                />
                <button
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-alert px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void suspend(true)}
                >
                  <ShieldBan size={16} /> Suspend account
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
