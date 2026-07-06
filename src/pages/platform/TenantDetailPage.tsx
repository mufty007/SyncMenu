import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarPlus,
  ExternalLink,
  ShieldBan,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { StatusBadge } from "./ui";

interface TenantDetail {
  id: string;
  name: string;
  status: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  trial_ends_at: string;
  created_at: string;
  owner_email: string;
  screen_count: number;
  menu_count: number;
  subscription: {
    plan_id: string | null;
    status: string | null;
    stripe_customer_id: string | null;
    current_period_end: string | null;
  } | null;
}

export default function TenantDetailPage() {
  const { id } = useParams();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(14);
  const [reason, setReason] = useState("");

  async function load() {
    const { data } = await supabase.rpc("admin_get_tenant", { p_id: id });
    setTenant(data as TenantDetail);
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

  if (!tenant) {
    return (
      <div>
        <Link to="/platform/tenants" className="btn-ghost -ml-3">
          <ArrowLeft size={16} /> All tenants
        </Link>
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-mist/40" />
      </div>
    );
  }

  const suspended = tenant.status === "suspended";
  const stripeUrl = tenant.subscription?.stripe_customer_id
    ? `https://dashboard.stripe.com/test/customers/${tenant.subscription.stripe_customer_id}`
    : null;

  const rows: [string, React.ReactNode][] = [
    ["Status", <StatusBadge status={tenant.status} />],
    ["Owner", tenant.owner_email],
    ["Signed up", new Date(tenant.created_at).toLocaleDateString()],
    ["Trial ends", new Date(tenant.trial_ends_at).toLocaleDateString()],
    ["Screens / menus", `${tenant.screen_count} / ${tenant.menu_count}`],
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
        <ArrowLeft size={16} /> All tenants
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <StatusBadge status={tenant.status} />
      </div>

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
          <h2 className="font-semibold">Actions</h2>

          <div className="mt-4">
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
