import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Plug } from "lucide-react";
import Logo from "../../components/Logo";
import ScaledFrame from "../../components/ScaledFrame";
import MenuBoard, { TEMPLATES } from "../../templates/MenuBoard";
import { supabase } from "../../lib/supabase";
import { buildBillingPath, parseBillingParams, saveBillingIntent } from "../../lib/billingParams";
import { useAuth } from "../../context/AuthContext";
import { usePlatformSettings } from "../../lib/usePlatformSettings";
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

type MenuSource = "sample" | "clover";

export default function Onboarding() {
  const { session, restaurant, isPlatformAdmin, isDesigner, refreshRestaurant } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const billingIntent = parseBillingParams(searchParams);
  const { config } = usePlatformSettings();
  const cloverEnabled = config.clover.enabled;

  const cloverReturn = searchParams.get("clover");
  const importedMenuId = searchParams.get("menu_id");
  const cloverErrorMsg = searchParams.get("message");

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuSource, setMenuSource] = useState<MenuSource>("sample");
  const [importedId, setImportedId] = useState<string | null>(null);
  const [awaitingClover, setAwaitingClover] = useState(false);
  const [messagePendingAddon, setMessagePendingAddon] = useState(false);

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [brandColor, setBrandColor] = useState("#FF6B2C");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>("spotlight");
  const logoRef = useRef<HTMLInputElement>(null);

  const logoPreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile]
  );

  // Handle OAuth return while restaurant already exists
  useEffect(() => {
    if (cloverReturn === "imported" && importedMenuId) {
      setDone(true);
      setImportedId(importedMenuId);
      setAwaitingClover(false);
      setStep(3);
      void refreshRestaurant();
      setSearchParams({}, { replace: true });
    } else if (cloverReturn === "error") {
      setError(
        cloverErrorMsg
          ? decodeURIComponent(cloverErrorMsg)
          : "Clover connect or import failed. You can finish with a sample menu or try again from Integrations."
      );
      setAwaitingClover(false);
      setStep(2);
      setSearchParams({}, { replace: true });
    }
  }, [cloverReturn, importedMenuId, cloverErrorMsg, refreshRestaurant, setSearchParams]);

  // Persist addon intent from signup URL for billing later
  useEffect(() => {
    if (billingIntent.addon || billingIntent.plan) {
      saveBillingIntent(billingIntent);
    }
  }, [billingIntent.addon, billingIntent.plan, billingIntent.interval]);

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
  if (isDesigner) return <Navigate to="/studio" replace />;
  if (isPlatformAdmin && !restaurant) return <Navigate to="/platform" replace />;
  // Allow staying on onboarding when completing Clover return or mid-flow after restaurant create
  if (restaurant && !done && !awaitingClover && cloverReturn !== "imported" && cloverReturn !== "error") {
    return <Navigate to="/app" replace />;
  }

  async function createRestaurant(): Promise<string | null> {
    if (!session) return null;
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
      setError(rErr?.message ?? "Could not create your restaurant.");
      return null;
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
    return r.id as string;
  }

  async function createSampleMenu(restaurantId: string) {
    const { data: menu } = await supabase
      .from("menus")
      .insert({
        restaurant_id: restaurantId,
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
    return menu?.id as string | undefined;
  }

  async function finishSample() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);

    const restaurantId = restaurant?.id ?? (await createRestaurant());
    if (!restaurantId) {
      setBusy(false);
      return;
    }

    await createSampleMenu(restaurantId);
    setDone(true);
    await refreshRestaurant();
    localStorage.setItem("syncmenu.tour", "pending");
    setBusy(false);
    setStep(3);
  }

  async function finishWithClover() {
    if (!session || busy) return;
    setBusy(true);
    setError(null);

    // Need entitlement — check after restaurant exists
    let restaurantId = restaurant?.id ?? null;
    if (!restaurantId) {
      restaurantId = await createRestaurant();
      if (!restaurantId) {
        setBusy(false);
        return;
      }
      await refreshRestaurant();
    }

    const { data: cloverStatus } = await supabase.rpc("get_clover_integration", {
      p_restaurant_id: restaurantId,
    });
    const status = cloverStatus as { entitled?: boolean; feature_enabled?: boolean; available?: boolean };
    if (!status?.available) {
      // Not entitled yet — create sample menu and note pending
      await createSampleMenu(restaurantId);
      setDone(true);
      setError(null);
      localStorage.setItem("syncmenu.tour", "pending");
      setBusy(false);
      setStep(3);
      setMessagePendingAddon(true);
      return;
    }

    setAwaitingClover(true);
    const { data, error: err } = await supabase.functions.invoke("clover-oauth-start", {
      body: { intent: "onboarding_import", restaurant_id: restaurantId },
    });
    if (err) {
      setBusy(false);
      setAwaitingClover(false);
      setError(err.message);
      return;
    }
    const url = (data as { url?: string })?.url;
    if (!url) {
      setBusy(false);
      setAwaitingClover(false);
      setError("No OAuth URL returned");
      return;
    }
    window.location.href = url;
  }

  async function finish() {
    if (menuSource === "clover" && cloverEnabled) {
      await finishWithClover();
    } else {
      await finishSample();
    }
  }

  const canContinue = step === 0 ? name.trim().length > 1 : true;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className={`w-full ${step === 2 ? "max-w-3xl" : "max-w-md"}`}>
        <div className="mb-8 flex justify-center">
          <Logo size={34} />
        </div>

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
                  <p className="text-xs text-smoke">Optional — square PNG or JPG works best.</p>
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
              <h1 className="text-xl font-semibold">How do you want to start?</h1>
              <p className="mt-1 text-sm text-smoke">
                Import your Clover menu if you have the add-on, or start with sample items.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMenuSource("sample")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    menuSource === "sample"
                      ? "border-brand bg-brand/5 ring-1 ring-brand"
                      : "border-mist hover:border-smoke/40"
                  }`}
                >
                  <p className="font-semibold">Sample menu</p>
                  <p className="mt-1 text-xs text-smoke">
                    We create a starter menu you can edit — works for everyone.
                  </p>
                </button>
                {cloverEnabled && (
                  <button
                    type="button"
                    onClick={() => setMenuSource("clover")}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      menuSource === "clover"
                        ? "border-brand bg-brand/5 ring-1 ring-brand"
                        : "border-mist hover:border-smoke/40"
                    }`}
                  >
                    <p className="font-semibold inline-flex items-center gap-1.5">
                      <Plug size={16} className="text-brand" /> Import from Clover
                    </p>
                    <p className="mt-1 text-xs text-smoke">
                      Connect Clover and pull categories and items. Requires the Clover add-on.
                      {config.clover.pricing.monthly
                        ? ` From $${config.clover.pricing.monthly}/mo.`
                        : ""}
                    </p>
                  </button>
                )}
              </div>

              {menuSource === "sample" && (
                <>
                  <p className="mt-6 text-sm font-medium">Pick a look</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {TEMPLATES.filter((t) => t.id !== "custom").map((t) => {
                      const recommended = t.id === "spotlight" || t.id === "vivid";
                      return (
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
                            {recommended && (
                              <span className="ml-1.5 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                                Recommended
                              </span>
                            )}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <div className="text-center">
              <CheckCircle2 size={44} className="mx-auto text-live" />
              <h1 className="mt-4 text-xl font-semibold">
                You&apos;re all set{name.trim() ? `, ${name.trim()}` : ""}!
              </h1>
              {importedId ? (
                <>
                  <p className="mt-2 text-sm text-smoke">
                    Your Clover menu was imported. Edit items anytime — push to Clover from
                    Integrations when you are ready.
                  </p>
                  <button
                    className="btn-primary mt-6 w-full"
                    onClick={() => navigate(`/app/menus/${importedId}`, { replace: true })}
                  >
                    Open imported menu
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-smoke">
                    {messagePendingAddon
                      ? "We created a sample menu for now. Once your Clover add-on is enabled, connect and import from Settings → Integrations."
                      : "We created your first menu with sample items. Next up:"}
                  </p>
                  {!messagePendingAddon && (
                    <ul className="mx-auto mt-4 max-w-xs space-y-2 text-left text-sm text-smoke">
                      <li>1. Swap the sample items for your real menu</li>
                      <li>2. Pair a TV from the Screens page</li>
                      <li>3. Watch every edit go live in seconds</li>
                    </ul>
                  )}
                  <button
                    className="btn-primary mt-6 w-full"
                    onClick={() =>
                      navigate(
                        billingIntent.plan ? buildBillingPath(billingIntent) : "/app",
                        { replace: true }
                      )
                    }
                  >
                    {billingIntent.plan ? "Continue to checkout" : "Open my dashboard"}
                  </button>
                </>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-sm text-alert">{error}</p>}

          {step < 3 && (
            <div className="mt-8 flex items-center justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setStep(step - 1)}
                  disabled={busy}
                >
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
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => void finish()}
                >
                  {busy
                    ? menuSource === "clover"
                      ? "Connecting…"
                      : "Setting up…"
                    : menuSource === "clover"
                      ? "Connect Clover & import"
                      : "Create my menu"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
