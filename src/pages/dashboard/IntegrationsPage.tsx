import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plug, RefreshCw, Unplug } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import type { Menu } from "../../lib/types";

interface CloverIntegration {
  status: string;
  feature_enabled: boolean;
  entitled: boolean;
  available: boolean;
  clover_merchant_id?: string;
  delivery_menu_id?: string | null;
  last_full_sync_at?: string | null;
  last_push_at?: string | null;
  last_error?: string | null;
  connected?: boolean;
}

export default function IntegrationsPage() {
  const { restaurant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [integration, setIntegration] = useState<CloverIntegration | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmPush, setConfirmPush] = useState(false);

  async function load() {
    const [{ data: clover }, { data: menuRows }] = await Promise.all([
      supabase.rpc("get_clover_integration"),
      restaurant
        ? supabase.from("menus").select("id, name").eq("restaurant_id", restaurant.id).order("name")
        : Promise.resolve({ data: [] }),
    ]);
    setIntegration((clover as CloverIntegration) ?? null);
    setMenus((menuRows as Menu[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [restaurant?.id]);

  useEffect(() => {
    const cloverParam = searchParams.get("clover");
    const errMsg = searchParams.get("message");
    if (cloverParam === "connected") {
      setMessage("Clover connected. Choose your delivery menu and run a full sync.");
      setSearchParams({}, { replace: true });
      void load();
    } else if (cloverParam === "error") {
      setError(errMsg ? decodeURIComponent(errMsg) : "Clover connection failed");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!restaurant) return null;

  async function connectClover() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("clover-oauth-start");
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const url = (data as { url?: string })?.url;
    if (!url) {
      setError("No OAuth URL returned");
      return;
    }
    window.location.href = url;
  }

  async function disconnect() {
    if (!confirm("Disconnect Clover? Delivery menus will no longer update from SyncMenu.")) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.functions.invoke("clover-disconnect");
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage("Clover disconnected.");
    await load();
  }

  async function setDeliveryMenu(menuId: string) {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("set_clover_delivery_menu", {
      p_menu_id: menuId,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setIntegration(data as CloverIntegration);
    setConfirmPush(true);
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("clover-sync", {
      body: { action: "sync_now" },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const result = data as { errors?: { error: string }[] };
    if (result.errors?.length) {
      setError(result.errors[0].error);
    } else {
      setMessage("Sync queued and processed.");
    }
    setConfirmPush(false);
    await load();
  }

  if (loading) return <p className="text-sm text-smoke">Loading…</p>;

  const featureEnabled = integration?.feature_enabled ?? false;
  const entitled = integration?.entitled ?? false;
  const available = integration?.available ?? false;
  const connected = integration?.connected ?? false;

  return (
    <div className="max-w-2xl">
      <Link to="/app/settings" className="inline-flex items-center gap-1 text-sm text-smoke hover:text-ink">
        <ArrowLeft size={16} /> Settings
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Integrations</h1>
      <p className="mt-1 text-sm text-smoke">
        Push menu changes from SyncMenu to Clover. If Uber Eats or DoorDash are connected in Clover,
        they update automatically.
      </p>

      {!featureEnabled && (
        <div className="card mt-8 p-6 text-sm text-smoke">
          Clover delivery sync is not enabled on this platform yet. Contact support if you use Clover
          and want this feature.
        </div>
      )}

      {featureEnabled && !entitled && (
        <div className="card mt-8 p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Plug size={20} />
            </div>
            <div>
              <h2 className="font-semibold">Clover POS</h2>
              <p className="mt-1 text-pretty text-sm text-smoke">
                Clover delivery sync is a paid add-on. Add it to your SyncMenu
                subscription before connecting a merchant account.
              </p>
              <Link to="/app/billing" className="btn-primary mt-4">
                View Clover add-on
              </Link>
            </div>
          </div>
        </div>
      )}

      {available && (
        <div className="card mt-8 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Plug size={20} />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Clover POS</h2>
              <p className="mt-1 text-sm text-smoke">
                Edit your delivery menu in SyncMenu — changes push to Clover inventory.
              </p>
            </div>
          </div>

          {connected ? (
            <div className="mt-6 space-y-4 border-t border-mist pt-6">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-smoke">Status</p>
                  <p className="font-medium capitalize">{integration?.status}</p>
                </div>
                <div>
                  <p className="text-smoke">Clover merchant ID</p>
                  <p className="font-mono text-xs">{integration?.clover_merchant_id}</p>
                </div>
                {integration?.last_push_at && (
                  <div>
                    <p className="text-smoke">Last sync</p>
                    <p>{new Date(integration.last_push_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {integration?.last_error && (
                <div className="rounded-xl border border-alert/30 bg-alert/10 p-3 text-sm text-alert">
                  {integration.last_error}
                </div>
              )}

              <div>
                <label className="label">Delivery menu</label>
                <select
                  className="input"
                  value={integration?.delivery_menu_id ?? ""}
                  onChange={(e) => void setDeliveryMenu(e.target.value)}
                  disabled={busy}
                >
                  <option value="" disabled>
                    Select a menu…
                  </option>
                  {menus.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-smoke">
                  Only this menu syncs to Clover and delivery apps. TV boards can use other menus.
                </p>
              </div>

              {confirmPush && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-50 p-4 text-sm">
                  <p className="font-medium text-amber-950">Confirm full menu push</p>
                  <p className="mt-1 text-amber-900">
                    This will update your Clover menu. Uber Eats and DoorDash menus managed through
                    Clover may be overwritten. Manage this menu in SyncMenu going forward.
                  </p>
                  <button
                    className="btn-primary mt-3"
                    disabled={busy}
                    onClick={() => void syncNow()}
                  >
                    Push menu to Clover
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" disabled={busy} onClick={() => void syncNow()}>
                  <RefreshCw size={16} /> Sync now
                </button>
                <button className="btn-secondary text-alert" disabled={busy} onClick={() => void disconnect()}>
                  <Unplug size={16} /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 border-t border-mist pt-6">
              <p className="text-sm text-smoke">
                Requires an active Clover account with Online Ordering. Connect Uber Eats and/or
                DoorDash inside Clover first for delivery sync.
              </p>
              <button className="btn-primary mt-4" disabled={busy} onClick={() => void connectClover()}>
                <Plug size={16} /> Connect Clover
              </button>
            </div>
          )}
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-live/30 bg-live/10 p-4 text-sm">{message}</div>
      )}
      {error && <p className="mt-4 text-sm text-alert">{error}</p>}
    </div>
  );
}
