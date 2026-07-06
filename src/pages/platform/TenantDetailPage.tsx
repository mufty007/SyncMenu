import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { supabase } from "../../lib/supabase";

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

  if (!tenant) return <p className="text-sm text-smoke">Loading…</p>;

  async function suspend(suspendAccount: boolean) {
    if (!tenant) return;
    setBusy(true);
    await supabase.rpc("admin_suspend_tenant", {
      p_id: tenant.id,
      p_suspend: suspendAccount,
      p_reason: reason || null,
    });
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

  const stripeUrl = tenant.subscription?.stripe_customer_id
    ? `https://dashboard.stripe.com/test/customers/${tenant.subscription.stripe_customer_id}`
    : null;

  return (
    <div>
      <Link to="/platform/tenants" className="btn-ghost">
        <ArrowLeft size={16} /> All tenants
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{tenant.name}</h1>
      <p className="text-sm text-smoke">{tenant.owner_email}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold">Account</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-smoke">Status</dt>
              <dd className="capitalize">{tenant.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-smoke">Trial ends</dt>
              <dd>{new Date(tenant.trial_ends_at).toLocaleDateString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-smoke">Screens / menus</dt>
              <dd>
                {tenant.screen_count} / {tenant.menu_count}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-smoke">Subscription</dt>
              <dd className="capitalize">
                {tenant.subscription?.status ?? "none"}
                {tenant.subscription?.plan_id ? ` (${tenant.subscription.plan_id})` : ""}
              </dd>
            </div>
          </dl>
          {stripeUrl && (
            <a
              href={stripeUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary mt-4 inline-flex"
            >
              <ExternalLink size={16} /> Open in Stripe
            </a>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold">Actions</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label">Extend trial (days)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="input w-24"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
                <button className="btn-secondary" disabled={busy} onClick={() => void extendTrial()}>
                  Extend
                </button>
              </div>
            </div>
            {tenant.status === "active" ? (
              <div>
                <label className="label">Suspend reason (optional)</label>
                <input
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Policy violation, non-payment…"
                />
                <button
                  className="btn-primary mt-2 bg-alert hover:bg-alert"
                  disabled={busy}
                  onClick={() => void suspend(true)}
                >
                  Suspend account
                </button>
              </div>
            ) : (
              <button className="btn-primary" disabled={busy} onClick={() => void suspend(false)}>
                Unsuspend account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
