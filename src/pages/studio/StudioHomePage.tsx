import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Plus, Store } from "lucide-react";
import Logo from "../../components/Logo";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { trialDaysLeft } from "../../lib/format";
import type { AccountTransfer, RestaurantMember, Subscription } from "../../lib/types";

interface ClientRow {
  operator?: RestaurantMember | null;
  pendingOperator?: RestaurantMember | null;
  sub?: Subscription | null;
  transfer?: AccountTransfer | null;
}

export default function StudioHomePage() {
  const { studio, restaurants, setActiveRestaurantId, signOut, refreshRestaurant, session } =
    useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, ClientRow>>({});
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [inviteBusy, setInviteBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurants.length) {
      setMeta({});
      return;
    }
    const ids = restaurants.map((r) => r.id);
    void Promise.all([
      supabase.from("restaurant_members").select("*").in("restaurant_id", ids),
      supabase.from("subscriptions").select("*").in("restaurant_id", ids),
      supabase
        .from("account_transfers")
        .select("*")
        .in("restaurant_id", ids)
        .eq("status", "pending"),
    ]).then(([membersRes, subsRes, txRes]) => {
      const next: Record<string, ClientRow> = {};
      for (const id of ids) next[id] = {};
      for (const m of (membersRes.data as RestaurantMember[]) ?? []) {
        if (m.role !== "operator") continue;
        if (m.accepted_at) next[m.restaurant_id].operator = m;
        else next[m.restaurant_id].pendingOperator = m;
      }
      for (const s of (subsRes.data as Subscription[]) ?? []) {
        next[s.restaurant_id].sub = s;
      }
      for (const t of (txRes.data as AccountTransfer[]) ?? []) {
        next[t.restaurant_id].transfer = t;
      }
      setMeta(next);
    });
  }, [restaurants]);

  async function addRestaurant() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("studio_create_restaurant", {
      p_name: name.trim(),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setName("");
    await refreshRestaurant();
    if (typeof data === "string") {
      setActiveRestaurantId(data);
      navigate("/app/menus");
    }
  }

  async function inviteOperator(restaurantId: string) {
    const email = inviteEmail[restaurantId]?.trim();
    if (!email) return;
    setInviteBusy(restaurantId);
    setError(null);
    const { data, error: err } = await supabase.rpc("invite_restaurant_member", {
      p_restaurant_id: restaurantId,
      p_email: email,
      p_role: "operator",
    });
    if (err) {
      setInviteBusy(null);
      setError(err.message);
      return;
    }
    const token = (data as { token?: string } | null)?.token;
    if (token) {
      await supabase.functions.invoke("send-studio-invite", {
        body: {
          token,
          origin: window.location.origin,
        },
      });
    }
    setInviteBusy(null);
    setInviteEmail((e) => ({ ...e, [restaurantId]: "" }));
    await refreshRestaurant();
    const { data: members } = await supabase
      .from("restaurant_members")
      .select("*")
      .eq("restaurant_id", restaurantId);
    setMeta((prev) => ({
      ...prev,
      [restaurantId]: {
        ...prev[restaurantId],
        pendingOperator:
          ((members as RestaurantMember[]) ?? []).find(
            (m) => m.role === "operator" && !m.accepted_at
          ) ?? null,
      },
    }));
  }

  function openRestaurant(id: string) {
    setActiveRestaurantId(id);
    navigate("/app/menus");
  }

  return (
    <div className="min-h-screen bg-cloud">
      <header className="border-b border-mist bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo size={26} />
          <div className="flex items-center gap-2">
            <p className="hidden text-sm text-smoke sm:block">{session?.user.email}</p>
            <button className="btn-ghost" onClick={() => void signOut()}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">Studio</p>
            <h1 className="mt-1 text-2xl font-semibold">{studio?.name ?? "Your studio"}</h1>
            <p className="mt-1 text-sm text-smoke">
              Free for you. Each restaurant pays SyncMenu a monthly fee.
            </p>
          </div>
        </div>

        <form
          className="card mt-8 flex flex-wrap items-end gap-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void addRestaurant();
          }}
        >
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="new-restaurant">
              Add a restaurant
            </label>
            <input
              id="new-restaurant"
              className="input"
              placeholder="Restaurant name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button className="btn-primary" disabled={busy || name.trim().length < 2}>
            <Plus size={16} /> {busy ? "Adding…" : "Add restaurant"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-alert">{error}</p>}

        {restaurants.length === 0 ? (
          <div className="card mt-8 flex flex-col items-center p-14 text-center">
            <Store size={36} className="text-smoke" strokeWidth={1.5} />
            <p className="mt-4 font-medium">No restaurants yet</p>
            <p className="mt-1 max-w-sm text-sm text-smoke">
              Add a client, design their boards, then invite the owner to edit prices and pay.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {restaurants.map((r) => {
              const info = meta[r.id];
              const days = trialDaysLeft(r.trial_ends_at);
              const paid =
                info?.sub?.status === "active" || info?.sub?.status === "trialing";
              return (
                <div key={r.id} className="card p-5">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => openRestaurant(r.id)}
                  >
                    <p className="font-semibold group-hover:text-brand">{r.name}</p>
                    <p className="mt-1 text-xs text-smoke">
                      {paid
                        ? `Subscribed${info?.sub?.plan_id ? ` · ${info.sub.plan_id.replace(/_/g, " ")}` : ""}`
                        : days > 0
                          ? `Trial · ${days} day${days === 1 ? "" : "s"} left`
                          : "Trial ended — waiting on payment"}
                    </p>
                    {info?.transfer && (
                      <p className="mt-2 text-xs font-medium text-amber">
                        Transfer pending — confirm in the dashboard
                      </p>
                    )}
                  </button>

                  <div className="mt-4 rounded-xl bg-cloud p-3 text-sm">
                    {info?.operator ? (
                      <p>
                        Restaurant access:{" "}
                        <strong>{info.operator.invited_email ?? "Accepted"}</strong>
                      </p>
                    ) : info?.pendingOperator ? (
                      <p className="text-smoke">
                        Invite sent to <strong>{info.pendingOperator.invited_email}</strong>
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          className="input flex-1"
                          type="email"
                          placeholder="Owner email"
                          value={inviteEmail[r.id] ?? ""}
                          onChange={(e) =>
                            setInviteEmail((m) => ({ ...m, [r.id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={inviteBusy === r.id}
                          onClick={() => void inviteOperator(r.id)}
                        >
                          {inviteBusy === r.id ? "Sending…" : "Invite"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button className="btn-primary flex-1" onClick={() => openRestaurant(r.id)}>
                      Open dashboard
                    </button>
                    <Link to="/app/billing" className="btn-secondary" onClick={() => setActiveRestaurantId(r.id)}>
                      Billing
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
