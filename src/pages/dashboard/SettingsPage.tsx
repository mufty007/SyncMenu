import { Link } from "react-router-dom";
import { useRef, useState, type FormEvent } from "react";
import { ImagePlus, Plug } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD"];

export default function SettingsPage() {
  const { restaurant, refreshRestaurant, canDesign, role, session } = useAuth();
  const [name, setName] = useState(restaurant?.name ?? "");
  const [currency, setCurrency] = useState(restaurant?.currency ?? "USD");
  const [brandColor, setBrandColor] = useState(restaurant?.brand_color ?? "#FF6B2C");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [designerEmail, setDesignerEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!restaurant) return null;

  const partnerManaged = !!restaurant.managed_by_studio_id;
  const canInviteDesigner = role === "owner" && !partnerManaged;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canDesign) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("restaurants")
      .update({ name: name.trim(), currency, brand_color: brandColor })
      .eq("id", restaurant!.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshRestaurant();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function uploadLogo(file: File) {
    if (!canDesign) return;
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${restaurant!.id}/logo-${Date.now()}.${ext}`;
    setBusy(true);
    const { error: err } = await supabase.storage.from("menu-images").upload(path, file, {
      upsert: true,
    });
    if (err) {
      setBusy(false);
      setError(`Upload failed: ${err.message}`);
      return;
    }
    const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
    await supabase
      .from("restaurants")
      .update({ logo_url: data.publicUrl })
      .eq("id", restaurant!.id);
    await refreshRestaurant();
    setBusy(false);
  }

  async function requestTransfer(direction: "to_restaurant" | "to_studio") {
    if (!restaurant) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("request_account_transfer", {
      p_restaurant_id: restaurant.id,
      p_direction: direction,
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    await supabase.functions.invoke("send-transfer-notice", {
      body: { restaurant_id: restaurant.id, origin: window.location.origin },
    });
    setBusy(false);
    await refreshRestaurant();
  }

  async function inviteDesigner() {
    if (!restaurant || !designerEmail.trim()) return;
    setBusy(true);
    setError(null);
    setInviteMsg(null);
    const { data, error: err } = await supabase.rpc("invite_restaurant_member", {
      p_restaurant_id: restaurant.id,
      p_email: designerEmail.trim(),
      p_role: "designer",
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const token = (data as { token?: string } | null)?.token;
    if (token) {
      await supabase.functions.invoke("send-studio-invite", {
        body: { token, origin: window.location.origin },
      });
    }
    setBusy(false);
    setDesignerEmail("");
    setInviteMsg("Invite sent.");
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-smoke">
        {canDesign
          ? "Your restaurant profile — shown on every menu board."
          : "Brand settings are managed by your designer. You can still handle billing and screens."}
      </p>

      <form onSubmit={save} className="card mt-8 space-y-5 p-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-mist bg-cloud"
            onClick={() => canDesign && fileRef.current?.click()}
            title="Upload logo"
            disabled={!canDesign}
          >
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <ImagePlus size={22} className="text-smoke" />
            )}
          </button>
          <div>
            <p className="font-medium">Logo</p>
            <p className="text-xs text-smoke">PNG or JPG, square works best.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadLogo(f);
              e.target.value = "";
            }}
          />
        </div>

        <div>
          <label className="label" htmlFor="rname">
            Restaurant name
          </label>
          <input
            id="rname"
            required
            className="input"
            value={name}
            disabled={!canDesign}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="label" htmlFor="rcurrency">
              Currency
            </label>
            <select
              id="rcurrency"
              className="input"
              value={currency}
              disabled={!canDesign}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rcolor">
              Brand color
            </label>
            <input
              id="rcolor"
              type="color"
              disabled={!canDesign}
              className="h-[42px] w-16 cursor-pointer rounded-xl border border-mist bg-white p-1"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-alert">{error}</p>}
        {canDesign && (
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
            {saved && <span className="text-sm font-medium text-live">Saved!</span>}
          </div>
        )}
      </form>

      {canDesign && (
        <Link
          to="/app/settings/integrations"
          className="card mt-6 flex items-center gap-4 p-6 transition-colors hover:border-brand/30"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Plug size={20} />
          </div>
          <div>
            <p className="font-medium">Integrations</p>
            <p className="text-sm text-smoke">Connect Clover to push menu changes to delivery apps.</p>
          </div>
        </Link>
      )}

      {canInviteDesigner && (
        <section className="card mt-6 space-y-3 p-6">
          <h2 className="font-semibold">Invite a designer</h2>
          <p className="text-sm text-smoke">
            Invite a SyncMenu studio to design boards. You keep billing until you
            confirm a transfer.
          </p>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              type="email"
              placeholder="Designer email"
              value={designerEmail}
              onChange={(e) => setDesignerEmail(e.target.value)}
            />
            <button className="btn-secondary" disabled={busy} onClick={() => void inviteDesigner()}>
              Invite
            </button>
          </div>
          {inviteMsg && <p className="text-sm text-live">{inviteMsg}</p>}
        </section>
      )}

      {partnerManaged && (
        <section className="card mt-6 space-y-3 p-6">
          <h2 className="font-semibold">Account control</h2>
          <p className="text-sm text-smoke">
            Transfers need the other party to confirm. The Stripe subscription stays as-is.
          </p>
          {role === "operator" && (
            <button
              className="btn-secondary w-full"
              disabled={busy}
              onClick={() => void requestTransfer("to_restaurant")}
            >
              Request full control for the restaurant
            </button>
          )}
          {role === "owner" && (
            <button
              className="btn-secondary w-full"
              disabled={busy}
              onClick={() => void requestTransfer("to_studio")}
            >
              Return design control to the studio
            </button>
          )}
          {role === "designer" && (
            <button
              className="btn-secondary w-full"
              disabled={busy}
              onClick={() => void requestTransfer("to_restaurant")}
            >
              Hand this account to the restaurant
            </button>
          )}
          {session && <p className="text-xs text-smoke">A banner appears for the other party until they confirm.</p>}
        </section>
      )}
    </div>
  );
}
