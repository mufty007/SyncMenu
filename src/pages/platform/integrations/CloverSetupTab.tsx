import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, RefreshCw, Save, Sparkles } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import type { CloverAdminSettings } from "./types";

function generateSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type SetupStatus = "not_configured" | "configured" | "ready";

function deriveStatus(s: CloverAdminSettings): SetupStatus {
  if (s.ready) return "ready";
  if (s.configured) return "configured";
  return "not_configured";
}

export default function CloverSetupTab() {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CloverAdminSettings | null>(null);

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [oauthStateSecret, setOauthStateSecret] = useState("");
  const [enabled, setEnabled] = useState(false);

  function applySettings(s: CloverAdminSettings) {
    setSettings(s);
    setAppId(s.app_id);
    setEnvironment(s.environment);
    setEnabled(s.enabled);
    setAppSecret("");
    setOauthStateSecret("");
  }

  useEffect(() => {
    void supabase.rpc("admin_get_clover_settings").then(({ data, error: err }) => {
      if (!err && data) applySettings(data as CloverAdminSettings);
      setLoaded(true);
    });
  }, []);

  const status = useMemo(() => (settings ? deriveStatus(settings) : "not_configured"), [settings]);

  async function save() {
    if (!appId.trim()) {
      setError("App ID is required.");
      return;
    }
    if (!settings?.app_secret_set && !appSecret.trim()) {
      setError("App Secret is required.");
      return;
    }
    if (!settings?.oauth_state_secret_set && !oauthStateSecret.trim()) {
      setError("OAuth state secret is required — click Generate.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const payload: Record<string, unknown> = {
      app_id: appId.trim(),
      environment,
      enabled,
    };
    if (appSecret.trim()) payload.app_secret = appSecret.trim();
    if (oauthStateSecret.trim()) payload.oauth_state_secret = oauthStateSecret.trim();

    const { data, error: err } = await supabase.rpc("admin_update_clover_settings", {
      p_clover: payload,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    applySettings(data as CloverAdminSettings);
    setMessage("Clover settings saved.");
  }

  async function testConnection() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { data, error: err } = await supabase.functions.invoke("clover-test-connection", {
      body: {},
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const result = data as { ok: boolean; message?: string; error?: string };
    if (!result.ok) {
      setError(result.error ?? "Connection test failed");
      return;
    }
    setMessage(result.message ?? "Clover credentials look valid.");
  }

  async function copyRedirect() {
    if (!settings?.oauth_redirect_uri) return;
    await navigator.clipboard.writeText(settings.oauth_redirect_uri);
    setMessage("OAuth redirect URI copied.");
  }

  if (!loaded) {
    return <div className="h-48 animate-pulse rounded-2xl bg-mist/40" />;
  }

  const statusBanner = {
    not_configured: {
      icon: AlertCircle,
      className: "border-alert/30 bg-alert/10 text-alert",
      title: "Not configured",
      text: "Enter your Clover App ID, App Secret, and OAuth state secret.",
    },
    configured: {
      icon: RefreshCw,
      className: "border-amber-400/30 bg-amber-50 text-amber-900",
      title: "Configured",
      text: "Credentials saved. Enable the feature when you're ready for owners to connect.",
    },
    ready: {
      icon: CheckCircle2,
      className: "border-live/30 bg-live/10 text-ink",
      title: "Live",
      text: "Clover delivery sync is enabled for restaurant owners.",
    },
  }[status];

  const StatusIcon = statusBanner.icon;

  return (
    <div className="space-y-6">
      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${statusBanner.className}`}>
        <StatusIcon size={20} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">{statusBanner.title}</p>
          <p className="mt-0.5 text-sm opacity-90">{statusBanner.text}</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">Clover Developer app</h2>
        <p className="mt-1 text-sm text-smoke">
          One-time platform credentials from the Clover Developer Dashboard. Restaurant owners connect
          their own Clover accounts via OAuth — they never see these keys.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="label">App ID *</label>
            <input
              className="input font-mono"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="Clover client_id"
            />
          </div>
          <div>
            <label className="label">App Secret *</label>
            <input
              type="password"
              className="input font-mono"
              placeholder={
                settings?.app_secret_set
                  ? `Saved (${settings.app_secret_masked}) — enter new to replace`
                  : "Clover client_secret"
              }
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">Environment</label>
            <select
              className="input"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as "sandbox" | "production")}
            >
              <option value="sandbox">Sandbox (development)</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="label">OAuth state secret *</label>
            <div className="flex gap-2">
              <input
                type="password"
                className="input font-mono flex-1"
                placeholder={
                  settings?.oauth_state_secret_set
                    ? "Saved — enter new to replace"
                    : "Random string"
                }
                value={oauthStateSecret}
                onChange={(e) => setOauthStateSecret(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={() => setOauthStateSecret(generateSecret())}
                title="Generate random secret"
              >
                <Sparkles size={16} />
              </button>
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="label">OAuth redirect URI (paste into Clover REST config)</label>
            <div className="flex gap-2">
              <input
                className="input font-mono flex-1"
                readOnly
                value={settings?.oauth_redirect_uri ?? ""}
              />
              <button type="button" className="btn-secondary shrink-0" onClick={() => void copyRedirect()}>
                <Copy size={16} />
              </button>
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-mist text-brand"
              />
              <span className="text-sm">
                Enable Clover delivery sync for restaurant owners
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => void save()}>
            <Save size={16} /> Save Clover settings
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => void testConnection()}>
            <RefreshCw size={16} /> Verify credentials saved
          </button>
        </div>
      </div>

      <div className="card p-6 text-sm text-smoke">
        <h3 className="font-medium text-ink">Clover app checklist</h3>
        <ul className="mt-3 list-inside list-disc space-y-1">
          <li>App type: Private app, platform: Web</li>
          <li>Permissions: Read Merchant, Read Inventory, Write Inventory</li>
          <li>REST Site URL: your SyncMenu site (e.g. syncmenuapp.com)</li>
          <li>Redirect URI: copy the value above into Clover REST configuration</li>
          <li>Restaurants must connect Uber Eats / DoorDash inside Clover for delivery sync</li>
        </ul>
      </div>

      {message && (
        <div className="rounded-xl border border-live/30 bg-live/10 p-4 text-sm">{message}</div>
      )}
      {error && <p className="text-sm text-alert">{error}</p>}
    </div>
  );
}
