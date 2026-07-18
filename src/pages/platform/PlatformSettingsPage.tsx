import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  DEFAULT_PLATFORM_CONFIG,
  mergePlatformConfig,
  type PlatformConfig,
} from "../../lib/platformConfig";
import { invalidatePlatformSettingsCache } from "../../lib/usePlatformSettings";
import { PageHeader } from "./ui";

const PLAN_IDS = ["trial", "starter", "growth", "pro"] as const;
const PAID_PLAN_IDS = ["starter", "growth", "pro"] as const;

export default function PlatformSettingsPage() {
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.rpc("admin_get_platform_settings").then(({ data, error: err }) => {
      if (!err && data) setConfig(mergePlatformConfig(data));
      setLoaded(true);
    });
  }, []);

  function updateLimit(plan: string, field: "screens" | "menus", value: number) {
    setConfig((c) => ({
      ...c,
      plan_limits: {
        ...c.plan_limits,
        [plan]: { ...c.plan_limits[plan], [field]: value },
      },
    }));
  }

  function updatePricing(plan: string, field: "monthly" | "annualMonthly", value: number) {
    setConfig((c) => ({
      ...c,
      pricing: {
        ...c.pricing,
        [plan]: { ...c.pricing[plan], [field]: value },
      },
    }));
  }

  function updateCloverPricing(
    field: "monthly" | "annualMonthly",
    value: number
  ) {
    setConfig((c) => ({
      ...c,
      clover: {
        ...c.clover,
        pricing: { ...c.clover.pricing, [field]: value },
      },
    }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { data, error: err } = await supabase.rpc("admin_update_platform_settings", {
      p_config: config,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    invalidatePlatformSettingsCache();
    setConfig(mergePlatformConfig(data));
    setMessage("Settings saved. New signups and plan limits use these values immediately.");
  }

  if (!loaded) {
    return <div className="h-48 animate-pulse rounded-2xl bg-mist/40" />;
  }

  return (
    <div>
      <PageHeader
        title="Platform settings"
        subtitle="Configure trials, plan limits, pricing, and platform defaults — no code deploy needed."
        actions={
          <button className="btn-primary" disabled={busy} onClick={() => void save()}>
            <Save size={16} />
            {busy ? "Saving…" : "Save changes"}
          </button>
        }
      />

      {message && (
        <div className="mt-6 rounded-xl border border-live/30 bg-live/10 p-4 text-sm">{message}</div>
      )}
      {error && <p className="mt-4 text-sm text-alert">{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-semibold">Trial & platform</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label">Default trial length (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                className="input"
                value={config.trial_days}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, trial_days: Number(e.target.value) }))
                }
              />
              <p className="mt-1 text-xs text-smoke">Applied to new restaurants on signup.</p>
            </div>
            <div>
              <label className="label">Max platform admins</label>
              <input
                type="number"
                min={1}
                max={10}
                className="input"
                value={config.max_admins}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, max_admins: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <label className="label">Support email</label>
              <input
                type="email"
                className="input"
                value={config.support_email}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, support_email: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Public site URL</label>
              <input
                type="url"
                className="input"
                value={config.site_url}
                onChange={(e) => setConfig((c) => ({ ...c, site_url: e.target.value }))}
              />
              <p className="mt-1 text-xs text-smoke">
                Used in emails and links. Stripe/SMTP secrets stay in Supabase env.
              </p>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="font-semibold">Plan limits</h2>
          <p className="mt-1 text-sm text-smoke">Enforced on screen pairing and menu creation.</p>
          <div className="mt-4 space-y-4">
            {PLAN_IDS.map((plan) => (
              <div key={plan} className="rounded-xl bg-cloud p-4">
                <p className="text-sm font-medium capitalize">{plan}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Screens</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={config.plan_limits[plan]?.screens ?? 1}
                      onChange={(e) => updateLimit(plan, "screens", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">Menus</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={config.plan_limits[plan]?.menus ?? 1}
                      onChange={(e) => updateLimit(plan, "menus", Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-6 lg:col-span-2">
          <h2 className="font-semibold">Pricing (display & checkout labels)</h2>
          <p className="mt-1 text-sm text-smoke">
            Shown on the landing page and billing screen. Stripe charges use Dashboard price
            nicknames — keep amounts in sync.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {PAID_PLAN_IDS.map((plan) => (
              <div key={plan} className="rounded-xl bg-cloud p-4">
                <p className="text-sm font-medium capitalize">{plan}</p>
                <div className="mt-2 space-y-3">
                  <div>
                    <label className="label">Monthly ($)</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={config.pricing[plan]?.monthly ?? 0}
                      onChange={(e) => updatePricing(plan, "monthly", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">Annual / mo ($)</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={config.pricing[plan]?.annualMonthly ?? 0}
                      onChange={(e) =>
                        updatePricing(plan, "annualMonthly", Number(e.target.value))
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-mist bg-cloud p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Clover add-on</p>
                <p className="mt-1 text-xs text-smoke">
                  Display price. Stripe charges use the Clover and Clover Yearly nicknames.
                </p>
              </div>
              <span className="rounded-full bg-mist px-2.5 py-1 text-xs text-smoke">
                Optional add-on
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Monthly ($)</label>
                <input
                  type="number"
                  min={1}
                  className="input tabular-nums"
                  value={config.clover.pricing.monthly}
                  onChange={(e) =>
                    updateCloverPricing("monthly", Number(e.target.value))
                  }
                />
              </div>
              <div>
                <label className="label">Annual / mo ($)</label>
                <input
                  type="number"
                  min={1}
                  className="input tabular-nums"
                  value={config.clover.pricing.annualMonthly}
                  onChange={(e) =>
                    updateCloverPricing("annualMonthly", Number(e.target.value))
                  }
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
