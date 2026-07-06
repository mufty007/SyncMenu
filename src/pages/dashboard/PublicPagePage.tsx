import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Copy, ExternalLink, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  LINK_DEFS,
  type LinkKind,
  type Menu,
  type RestaurantLinks,
} from "../../lib/types";

const GROUPS: { kind: LinkKind; title: string; blurb: string }[] = [
  { kind: "order", title: "Ordering", blurb: "Buttons customers tap to order delivery" },
  { kind: "contact", title: "Contact", blurb: "Call button and your website" },
  { kind: "social", title: "Social profiles", blurb: "Shown as icons under your name" },
];

export default function PublicPagePage() {
  const { restaurant, refreshRestaurant } = useAuth();
  const [links, setLinks] = useState<RestaurantLinks>(restaurant?.links ?? {});
  const [about, setAbout] = useState(restaurant?.about ?? "");
  const [menus, setMenus] = useState<Menu[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    supabase
      .from("menus")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("name")
      .then(({ data }) => setMenus((data as Menu[]) ?? []));
  }, [restaurant]);

  if (!restaurant) return null;
  const hubUrl = `${window.location.origin}/r/${restaurant.id}`;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const cleaned = Object.fromEntries(
      Object.entries(links).filter(([, v]) => (v ?? "").trim() !== "")
    );
    const { error: err } = await supabase
      .from("restaurants")
      .update({ links: cleaned, about: about.trim() })
      .eq("id", restaurant!.id);
    setBusy(false);
    if (err) {
      setError(
        err.message.includes("links")
          ? `${err.message} — did you run migration 0003?`
          : err.message
      );
      return;
    }
    await refreshRestaurant();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function toggleHubMenu(menu: Menu, show: boolean) {
    setMenus((m) => m.map((x) => (x.id === menu.id ? { ...x, show_on_hub: show } : x)));
    await supabase.from("menus").update({ show_on_hub: show }).eq("id", menu.id);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Public page</h1>
          <p className="mt-1 text-sm text-smoke">
            The page customers see when they scan your QR code — menus, ordering
            links and socials in one place.
          </p>
        </div>
        <a href={hubUrl} target="_blank" rel="noreferrer" className="btn-secondary">
          <ExternalLink size={15} /> Open page
        </a>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        {/* left column: links + menus */}
        <form onSubmit={save} className="space-y-6">
          <div className="card p-6">
            <label className="label" htmlFor="about">
              Tagline
            </label>
            <input
              id="about"
              className="input"
              placeholder="e.g. Flame-grilled chicken since 2012 — halal certified"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={120}
            />
          </div>

          {GROUPS.map((group) => (
            <div key={group.kind} className="card p-6">
              <h2 className="font-semibold">{group.title}</h2>
              <p className="mt-0.5 text-xs text-smoke">{group.blurb}</p>
              <div className="mt-4 space-y-3">
                {LINK_DEFS.filter((d) => d.kind === group.kind).map((def) => (
                  <div key={def.id} className="grid grid-cols-[110px_1fr] items-center gap-3">
                    <label htmlFor={`link-${def.id}`} className="text-sm font-medium">
                      {def.label}
                    </label>
                    <input
                      id={`link-${def.id}`}
                      className="input py-2"
                      placeholder={def.placeholder}
                      value={links[def.id] ?? ""}
                      onChange={(e) => setLinks((l) => ({ ...l, [def.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="card p-6">
            <h2 className="font-semibold">Menus on your page</h2>
            <p className="mt-0.5 text-xs text-smoke">
              Ticked menus appear as tabs for customers.
            </p>
            <div className="mt-4 space-y-2">
              {menus.map((menu) => (
                <label key={menu.id} className="flex cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={menu.show_on_hub ?? true}
                    onChange={(e) => void toggleHubMenu(menu, e.target.checked)}
                  />
                  {menu.name}
                </label>
              ))}
              {menus.length === 0 && (
                <p className="text-sm text-smoke">
                  No menus yet —{" "}
                  <Link to="/app/menus" className="font-medium text-brand">
                    create one first
                  </Link>
                  .
                </p>
              )}
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

        {/* right column: share & print */}
        <div className="card sticky top-8 p-6 text-center">
          <h2 className="font-semibold">Your QR code</h2>
          <p className="mt-0.5 text-xs text-smoke">
            One code for everything — tables, windows, bags.
          </p>
          <div className="mx-auto mt-4 w-fit rounded-2xl border-4 border-brand bg-white p-3">
            <QRCodeSVG value={hubUrl} size={150} />
          </div>
          <button
            className="btn-secondary mt-4 w-full"
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(hubUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Copy size={14} /> {copied ? "Copied!" : "Copy link"}
          </button>
          <div className="mt-5 border-t border-mist pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-smoke">
              Print kit
            </p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["poster", "A4 poster"],
                  ["tent", "Table tent card"],
                  ["stickers", "Sticker sheet"],
                ] as const
              ).map(([format, label]) => (
                <Link
                  key={format}
                  to={`/app/print-qr/${format}`}
                  className="btn-secondary w-full"
                >
                  <Printer size={14} /> {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
