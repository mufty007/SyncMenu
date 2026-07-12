import { Link } from "react-router-dom";
import { useRef, useState, type FormEvent } from "react";
import { ImagePlus, Plug } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

const CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD"];

export default function SettingsPage() {
  const { restaurant, refreshRestaurant } = useAuth();
  const [name, setName] = useState(restaurant?.name ?? "");
  const [currency, setCurrency] = useState(restaurant?.currency ?? "USD");
  const [brandColor, setBrandColor] = useState(restaurant?.brand_color ?? "#FF6B2C");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!restaurant) return null;

  async function save(e: FormEvent) {
    e.preventDefault();
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

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-smoke">
        Your restaurant profile — shown on every menu board.
      </p>

      <form onSubmit={save} className="card mt-8 space-y-5 p-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-mist bg-cloud"
            onClick={() => fileRef.current?.click()}
            title="Upload logo"
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
              className="h-[42px] w-16 cursor-pointer rounded-xl border border-mist bg-white p-1"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-alert">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-sm font-medium text-live">Saved!</span>}
        </div>
      </form>

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
    </div>
  );
}
