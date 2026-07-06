import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus } from "lucide-react";
import Logo from "../../components/Logo";
import ScaledFrame from "../../components/ScaledFrame";
import MenuBoard, { TEMPLATES } from "../../templates/MenuBoard";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import type { TemplateId } from "../../lib/types";

const CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD"];
const COLOR_PRESETS = ["#FF6B2C", "#E5484D", "#22B573", "#2563EB", "#7C3AED", "#1F2933"];
const STEPS = ["Your restaurant", "Your brand", "First menu"];

/** Starter content so the first menu isn't a blank page. */
const STARTER_SECTIONS: { name: string; items: [string, string, number][] }[] = [
  {
    name: "Mains",
    items: [
      ["House Burger", "Your bestseller goes here", 8.9],
      ["Grilled Wrap", "Describe it in a few words", 6.5],
    ],
  },
  {
    name: "Sides",
    items: [
      ["Golden Fries", "Crispy and fresh", 3.0],
      ["Side Salad", "", 3.5],
    ],
  },
  {
    name: "Drinks",
    items: [["Soft Drink", "Coke, Fanta, Sprite", 1.9]],
  },
];

export default function Onboarding() {
  const { session, restaurant, isPlatformAdmin, refreshRestaurant } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [brandColor, setBrandColor] = useState("#FF6B2C");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>("bold");
  const logoRef = useRef<HTMLInputElement>(null);

  const logoPreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile]
  );

  // sample data for the template previews on step 3
  const previewData = useMemo(
    () => ({
      restaurantName: name.trim() || "Your Restaurant",
      logoUrl: logoPreview,
      currency,
      menuName: "Main Menu",
      sections: STARTER_SECTIONS.map((s, si) => ({
        id: `s${si}`,
        menu_id: "preview",
        name: s.name,
        sort_order: si,
        items: s.items.map(([iname, description, price], ii) => ({
          id: `s${si}i${ii}`,
          section_id: `s${si}`,
          name: iname,
          description,
          price,
          image_url: null,
          available: true,
          sort_order: ii,
        })),
      })),
    }),
    [name, currency, logoPreview]
  );

  if (!session) return <Navigate to="/login" replace />;
  if (isPlatformAdmin && !restaurant) return <Navigate to="/platform" replace />;
  if (restaurant && !done) return <Navigate to="/app" replace />;

  async function finish() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);

    const { data: r, error: rErr } = await supabase
      .from("restaurants")
      .insert({
        owner_id: session.user.id,
        name: name.trim(),
        currency,
        brand_color: brandColor,
      })
      .select()
      .single();
    if (rErr || !r) {
      setBusy(false);
      setError(rErr?.message ?? "Could not create your restaurant.");
      return;
    }

    if (logoFile) {
      const ext = logoFile.name.split(".").pop() ?? "png";
      const path = `${r.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("menu-images")
        .upload(path, logoFile, { upsert: true });
      if (!upErr) {
        const { data: pub } = supabase.storage.from("menu-images").getPublicUrl(path);
        await supabase.from("restaurants").update({ logo_url: pub.publicUrl }).eq("id", r.id);
      }
    }

    const { data: menu } = await supabase
      .from("menus")
      .insert({
        restaurant_id: r.id,
        name: "Main Menu",
        template_id: templateId,
        template_config: { accent: brandColor },
      })
      .select()
      .single();
    if (menu) {
      for (const [si, section] of STARTER_SECTIONS.entries()) {
        const { data: sec } = await supabase
          .from("menu_sections")
          .insert({ menu_id: menu.id, name: section.name, sort_order: si })
          .select()
          .single();
        if (sec) {
          await supabase.from("menu_items").insert(
            section.items.map(([iname, description, price], ii) => ({
              section_id: sec.id,
              name: iname,
              description,
              price,
              sort_order: ii,
            }))
          );
        }
      }
    }

    setDone(true);
    await refreshRestaurant();
    localStorage.setItem("syncmenu.tour", "pending");
    setBusy(false);
    setStep(3);
  }

  const canContinue =
    step === 0 ? name.trim().length > 1 : true;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className={`w-full ${step === 2 ? "max-w-3xl" : "max-w-md"}`}>
        <div className="mb-8 flex justify-center">
          <Logo size={34} />
        </div>

        {/* progress */}
        {step < 3 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-medium text-smoke">
              <span>
                Step {step + 1} of {STEPS.length} — {STEPS[step]}
              </span>
              <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="card p-8">
          {step === 0 && (
            <>
              <h1 className="text-xl font-semibold">Welcome! Tell us about your shop</h1>
              <p className="mt-1 text-sm text-smoke">
                This shows up on your menu boards — you can change it anytime.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="label" htmlFor="ob-name">
                    Restaurant name
                  </label>
                  <input
                    id="ob-name"
                    required
                    autoFocus
                    className="input"
                    placeholder="e.g. Big Bite Chicken"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ob-currency">
                    Currency
                  </label>
                  <select
                    id="ob-currency"
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
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-xl font-semibold">Make it yours</h1>
              <p className="mt-1 text-sm text-smoke">
                Your logo and color appear on every board and your QR page.
              </p>
              <div className="mt-6 flex items-center gap-4">
                <button
                  type="button"
                  className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-mist bg-cloud"
                  onClick={() => logoRef.current?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <ImagePlus size={22} className="text-smoke" />
                  )}
                </button>
                <div>
                  <p className="font-medium">Logo</p>
                  <p className="text-xs text-smoke">
                    Optional — square PNG or JPG works best.
                  </p>
                  {logoFile && (
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-alert"
                      onClick={() => setLogoFile(null)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    setLogoFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="mt-6">
                <p className="label">Brand color</p>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBrandColor(c)}
                      className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${
                        brandColor.toLowerCase() === c.toLowerCase()
                          ? "border-ink"
                          : "border-transparent"
                      }`}
                      style={{ background: c }}
                      aria-label={`Brand color ${c}`}
                    />
                  ))}
                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-full border border-mist p-0.5"
                    aria-label="Custom brand color"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-xl font-semibold">Pick a look for your first menu</h1>
              <p className="mt-1 text-sm text-smoke">
                We'll set it up with sample items you can edit. You can switch
                templates anytime.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TEMPLATES.filter((t) => t.id !== "custom").map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplateId(t.id)}
                    className={`rounded-xl border p-2 text-left transition-colors ${
                      templateId === t.id
                        ? "border-brand bg-brand/5 ring-1 ring-brand"
                        : "border-mist hover:border-smoke/40"
                    }`}
                  >
                    <div className="overflow-hidden rounded-lg border border-mist/60">
                      <ScaledFrame designWidth={1920} designHeight={1080}>
                        <MenuBoard
                          data={previewData}
                          templateId={t.id}
                          config={{ accent: brandColor }}
                          orientation="landscape"
                        />
                      </ScaledFrame>
                    </div>
                    <p
                      className={`mt-2 text-sm font-semibold ${
                        templateId === t.id ? "text-brand" : ""
                      }`}
                    >
                      {t.name}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <div className="text-center">
              <CheckCircle2 size={44} className="mx-auto text-live" />
              <h1 className="mt-4 text-xl font-semibold">
                You're all set, {name.trim()}!
              </h1>
              <p className="mt-2 text-sm text-smoke">
                We created your first menu with sample items. Next up:
              </p>
              <ul className="mx-auto mt-4 max-w-xs space-y-2 text-left text-sm text-smoke">
                <li>1. Swap the sample items for your real menu</li>
                <li>2. Pair a TV from the Screens page</li>
                <li>3. Watch every edit go live in seconds</li>
              </ul>
              <button
                className="btn-primary mt-6 w-full"
                onClick={() => navigate("/app", { replace: true })}
              >
                Open my dashboard
              </button>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-alert">{error}</p>}

          {step < 3 && (
            <div className="mt-8 flex items-center justify-between">
              {step > 0 ? (
                <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
                  <ArrowLeft size={15} /> Back
                </button>
              ) : (
                <span />
              )}
              {step < 2 ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!canContinue}
                  onClick={() => setStep(step + 1)}
                >
                  Continue <ArrowRight size={15} />
                </button>
              ) : (
                <button type="button" className="btn-primary" disabled={busy} onClick={() => void finish()}>
                  {busy ? "Setting up…" : "Create my menu"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
