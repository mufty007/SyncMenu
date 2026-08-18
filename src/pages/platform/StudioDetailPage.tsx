import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Film,
  LayoutGrid,
  MonitorPlay,
  Save,
  ShieldBan,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatBytes, timeAgo, trialDaysLeft } from "../../lib/format";
import { PageHeader, StatCard, StatusBadge } from "./ui";

interface StudioRestaurant {
  id: string;
  name: string;
  status: string;
  trial_ends_at: string;
  created_at: string;
  currency: string;
  operator_email: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  screen_count: number;
  menu_count: number;
  playlist_count: number;
  storage_bytes: number;
  last_screen_seen_at: string | null;
  pending_operator_email: string | null;
}

interface FormerRestaurant {
  id: string;
  name: string;
  status: string;
  created_at: string;
  owner_email: string | null;
  plan_id: string | null;
  subscription_status: string | null;
}

interface StudioDetail {
  id: string;
  name: string;
  created_at: string;
  owner_email: string | null;
  owner_last_sign_in_at: string | null;
  owner_created_at: string | null;
  restaurant_count: number;
  paid_count: number;
  unpaid_count: number;
  trial_count: number;
  suspended_count: number;
  former_count: number;
  screen_count: number;
  online_screen_count: number;
  menu_count: number;
  playlist_count: number;
  media_count: number;
  storage_bytes: number;
  item_count: number;
  operator_count: number;
  pending_invite_count: number;
  last_screen_seen_at: string | null;
  last_menu_update_at: string | null;
  restaurants: StudioRestaurant[];
  former_restaurants: FormerRestaurant[];
}

export default function StudioDetailPage() {
  const { id } = useParams();
  const [studio, setStudio] = useState<StudioDetail | null>(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data, error: err } = await supabase.rpc("admin_get_studio", { p_id: id });
    if (err) {
      setError(err.message);
      return;
    }
    const row = data as StudioDetail;
    setStudio(row);
    setName(row.name);
    setError(null);
  }

  useEffect(() => {
    if (id) void load();
  }, [id]);

  async function saveName() {
    if (!studio) return;
    setBusy(true);
    setMessage(null);
    const { error: err } = await supabase.rpc("admin_update_studio", {
      p_id: studio.id,
      p_name: name,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage("Studio name updated.");
    void load();
  }

  async function suspendAll(suspend: boolean) {
    if (!studio) return;
    if (
      suspend &&
      !confirm(
        `Suspend every restaurant under "${studio.name}"? Their screens will go dark.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const { data, error: err } = await supabase.rpc("admin_suspend_studio", {
      p_id: studio.id,
      p_suspend: suspend,
      p_reason: reason || null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setReason("");
    const count = (data as { restaurants?: number } | null)?.restaurants ?? 0;
    setMessage(
      suspend
        ? `Suspended ${count} restaurant${count === 1 ? "" : "s"}.`
        : `Reactivated ${count} restaurant${count === 1 ? "" : "s"}.`
    );
    void load();
  }

  if (error && !studio) {
    return (
      <div>
        <Link to="/platform/studios" className="btn-ghost -ml-3">
          <ArrowLeft size={16} /> All designers
        </Link>
        <div className="card mt-6 border-alert/30 bg-alert/5 p-5 text-sm text-alert">{error}</div>
      </div>
    );
  }

  if (!studio) {
    return (
      <div>
        <Link to="/platform/studios" className="btn-ghost -ml-3">
          <ArrowLeft size={16} /> All designers
        </Link>
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-mist/40" />
      </div>
    );
  }

  return (
    <div>
      <Link to="/platform/studios" className="btn-ghost -ml-3">
        <ArrowLeft size={16} /> All designers
      </Link>

      <div className="mt-4">
        <PageHeader
          title={studio.name}
          subtitle={studio.owner_email ?? "No designer email on file"}
        />
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-live/30 bg-live/10 p-3 text-sm">{message}</div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-alert/30 bg-alert/5 p-3 text-sm text-alert">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Building2} label="Restaurants" value={studio.restaurant_count} accent />
        <StatCard
          icon={CreditCard}
          label="Paying shops"
          value={studio.paid_count}
          hint={`${studio.unpaid_count} unpaid · ${studio.trial_count} still on trial`}
        />
        <StatCard
          icon={MonitorPlay}
          label="Screens"
          value={studio.screen_count}
          hint={`${studio.online_screen_count} seen in the last 90s`}
        />
        <StatCard icon={LayoutGrid} label="Menus" value={studio.menu_count} hint={`${studio.item_count} items`} />
        <StatCard
          icon={Film}
          label="Media storage"
          value={formatBytes(Number(studio.storage_bytes) || 0)}
          hint={`${studio.media_count} files · ${studio.playlist_count} playlists`}
        />
        <StatCard
          icon={Sparkles}
          label="Operators"
          value={studio.operator_count}
          hint={
            studio.pending_invite_count
              ? `${studio.pending_invite_count} invite${studio.pending_invite_count === 1 ? "" : "s"} pending`
              : "All invited operators accepted"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold">Designer</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-smoke">Email</dt>
              <dd>{studio.owner_email || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-smoke">Studio created</dt>
              <dd>{new Date(studio.created_at).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-smoke">Account created</dt>
              <dd>
                {studio.owner_created_at
                  ? new Date(studio.owner_created_at).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-smoke">Last login</dt>
              <dd>{timeAgo(studio.owner_last_sign_in_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-smoke">Last menu edit</dt>
              <dd>{timeAgo(studio.last_menu_update_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-smoke">Last screen ping</dt>
              <dd>{timeAgo(studio.last_screen_seen_at)}</dd>
            </div>
          </dl>
        </div>

        <div className="card space-y-5 p-6">
          <div>
            <h2 className="font-semibold">Manage studio</h2>
            <p className="mt-1 text-sm text-smoke">
              Rename the workspace or freeze every restaurant this designer currently manages.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label className="label" htmlFor="studio-name">
                Studio name
              </label>
              <input
                id="studio-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button className="btn-primary" disabled={busy || name.trim().length < 2} onClick={() => void saveName()}>
              <Save size={16} /> Save
            </button>
          </div>
          <div>
            <label className="label" htmlFor="suspend-reason">
              Suspend reason
            </label>
            <input
              id="suspend-reason"
              className="input"
              placeholder="Optional note for the audit log"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn-secondary text-alert"
                disabled={busy || studio.restaurant_count === 0}
                onClick={() => void suspendAll(true)}
              >
                <ShieldBan size={16} /> Suspend all restaurants
              </button>
              <button
                className="btn-secondary"
                disabled={busy || studio.suspended_count === 0}
                onClick={() => void suspendAll(false)}
              >
                <ShieldCheck size={16} /> Reactivate all
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-mist px-5 py-4">
          <h2 className="font-semibold">Managed restaurants</h2>
          <p className="mt-0.5 text-sm text-smoke">
            Currently attached to this studio. Open a row to manage billing, trial, or Clover.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-mist bg-cloud/50 text-xs uppercase tracking-wide text-smoke">
              <tr>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Operator</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Usage</th>
              </tr>
            </thead>
            <tbody>
              {studio.restaurants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-smoke">
                    This studio has not created a restaurant yet.
                  </td>
                </tr>
              ) : (
                studio.restaurants.map((r) => {
                  const paid =
                    r.subscription_status === "active" || r.subscription_status === "trialing";
                  const days = trialDaysLeft(r.trial_ends_at);
                  return (
                    <tr key={r.id} className="border-b border-mist last:border-0 hover:bg-cloud/40">
                      <td className="px-4 py-3">
                        <Link
                          to={`/platform/tenants/${r.id}`}
                          className="font-medium text-brand hover:text-ember"
                        >
                          {r.name}
                        </Link>
                        <p className="mt-0.5 text-xs text-smoke">
                          Added {new Date(r.created_at).toLocaleDateString()}
                          {r.last_screen_seen_at
                            ? ` · screen ${timeAgo(r.last_screen_seen_at)}`
                            : " · no screens yet"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-smoke">
                        {r.operator_email || r.pending_operator_email || "Not invited"}
                        {!r.operator_email && r.pending_operator_email && (
                          <span className="mt-0.5 block text-xs">Invite pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-mist/60 px-2.5 py-1 text-xs font-medium capitalize text-smoke">
                          {r.plan_id ?? (days > 0 ? "trial" : "ended")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                        {!paid && r.status !== "suspended" && (
                          <span className="mt-1 block text-xs text-smoke">
                            {days > 0 ? `${days}d trial left` : "Unpaid"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-smoke">
                        <p className="tabular-nums">
                          {r.screen_count} screens · {r.menu_count} menus
                        </p>
                        <p className="mt-0.5 tabular-nums">
                          {r.playlist_count} playlists · {formatBytes(Number(r.storage_bytes) || 0)}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {studio.former_restaurants.length > 0 && (
        <div className="card mt-6 overflow-hidden">
          <div className="border-b border-mist px-5 py-4">
            <h2 className="font-semibold">Transferred away</h2>
            <p className="mt-0.5 text-sm text-smoke">
              Created by this studio, then handed to the restaurant. Subscription stays on the shop.
            </p>
          </div>
          <ul className="divide-y divide-mist">
            {studio.former_restaurants.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <Link to={`/platform/tenants/${r.id}`} className="font-medium text-brand hover:text-ember">
                    {r.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-smoke">
                    {r.owner_email || "No owner email"} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-mist/60 px-2.5 py-1 text-xs font-medium capitalize text-smoke">
                  {r.plan_id ?? r.subscription_status ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
