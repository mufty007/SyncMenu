import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Plug, RefreshCw, Unplug } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { usePlatformSettings } from "../../lib/usePlatformSettings";
import type { Menu } from "../../lib/types";

interface CloverIntegration {
  status: string;
  feature_enabled: boolean;
  entitled: boolean;
  available: boolean;
  clover_merchant_id?: string;
  delivery_menu_id?: string | null;
  imported_menu_id?: string | null;
  initial_import_status?: string;
  last_import_at?: string | null;
  last_import_error?: string | null;
  last_full_sync_at?: string | null;
  last_push_at?: string | null;
  last_error?: string | null;
  connected?: boolean;
}

export default function IntegrationsPage() {
  const { restaurant } = useAuth();
  const { config } = usePlatformSettings();
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
      supabase.rpc("get_clover_integration", {
        p_restaurant_id: restaurant?.id ?? null,
      }),
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
      setMessage("Clover connected. Import your menu, or choose a delivery menu to push later.");
      setSearchParams({}, { replace: true });
      void load();
    } else if (cloverParam === "error") {
      setError(errMsg ? decodeURIComponent(errMsg) : "Clover connection failed");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (!restaurant) return null;
  const restaurantId = restaurant.id;

  async function connectClover() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("clover-oauth-start", {
      body: { intent: "integrations", restaurant_id: restaurantId },
    });
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
    const { error: err } = await supabase.functions.invoke("clover-disconnect", {
      body: { restaurant_id: restaurantId },
    });
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
      p_restaurant_id: restaurantId,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setIntegration(data as CloverIntegration);
    setConfirmPush(true);
    setMessage("Delivery menu saved. Confirm below to push to Clover.");
  }

  async function importFromClover(forceNew = false) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { data, error: err } = await supabase.functions.invoke("clover-import", {
      body: { force_new: forceNew, restaurant_id: restaurantId },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const result = data as {
      ok?: boolean;
      menu_id?: string;
      items?: number;
      sections?: number;
      already_imported?: boolean;
      message?: string;
      error?: string;
    };
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.already_imported) {
      setMessage(result.message ?? "Menu already imported.");
    } else {
      setMessage(
        `Imported ${result.items ?? 0} items in ${result.sections ?? 0} categories. You can edit the menu before pushing to Clover.`
      );
    }
    await load();
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("clover-sync", {
      body: { action: "sync_now", restaurant_id: restaurantId },
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
  const importDone = integration?.initial_import_status === "done";
  const importRunning = integration?.initial_import_status === "running";

  return (
    <div className="max-w-2xl">
      <Link to="/app/settings" className="inline-flex items-center gap-1 text-sm text-smoke hover:text-ink">
        <ArrowLeft size={16} /> Settings
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Integrations</h1>
      <p className="mt-1 text-sm text-smoke">
        Import your Clover menu into SyncMenu, then push updates back when you are ready. Delivery
        apps linked in Clover follow your Clover inventory.
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
                Clover delivery sync is an add-on
                {config.clover.pricing.monthly
                  ? ` (from $${config.clover.pricing.monthly}/mo)`
                  : ""}
                . Ask SyncMenu support to enable it on your account, then connect Clover and import
                your menu.
              </p>
              <Link to="/contact" className="btn-primary mt-4">
                Contact support
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
                Pull categories and items from Clover to start editing in SyncMenu, then push a
                delivery menu when you are ready.
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
                {integration?.last_import_at && (
                  <div>
                    <p className="text-smoke">Last import</p>
                    <p>{new Date(integration.last_import_at).toLocaleString()}</p>
                  </div>
                )}
                {integration?.last_push_at && (
                  <div>
                    <p className="text-smoke">Last push</p>
                    <p>{new Date(integration.last_push_at).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {(integration?.last_error || integration?.last_import_error) && (
                <div className="rounded-xl border border-alert/30 bg-alert/10 p-3 text-sm text-alert">
                  {integration.last_import_error ?? integration.last_error}
                </div>
              )}

              <div className="rounded-xl border border-mist bg-cloud p-4">
                <p className="font-medium">Import from Clover</p>
                <p className="mt-1 text-sm text-smoke">
                  Creates a new SyncMenu menu with your Clover categories and items. Does not push
                  anything back to Clover.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="btn-primary"
                    disabled={busy || importRunning}
                    onClick={() => void importFromClover(!importDone)}
                  >
                    <Download size={16} />
                    {importRunning
                      ? "Importing…"
                      : importDone
                        ? "Re-import into new menu"
                        : "Import menu from Clover"}
                  </button>
                  {importDone && integration?.imported_menu_id && (
                    <Link
                      to={`/app/menus/${integration.imported_menu_id}`}
                      className="btn-secondary"
                    >
                      Open imported menu
                    </Link>
                  )}
                </div>
              </div>

              <div>
                <label className="label">Delivery menu (for push)</label>
                <select
                  className="input"
                  value={integration?.delivery_menu_id ?? ""}
                  onChange={(e) => {
                    if (e.target.value) void setDeliveryMenu(e.target.value);
                  }}
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
                  Selecting a menu saves it only — push happens after you confirm.
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
                <button
                  className="btn-secondary"
                  disabled={busy || !integration?.delivery_menu_id}
                  onClick={() => setConfirmPush(true)}
                >
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
                Requires an active Clover account. After connecting you can import your existing
                inventory into SyncMenu.
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
