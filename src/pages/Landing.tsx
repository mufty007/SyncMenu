import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ListVideo,
  MonitorPlay,
  Palette,
  Plug,
  QrCode,
  RefreshCw,
  Store,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import BillingIntervalToggle from "../components/BillingIntervalToggle";
import ScaledFrame from "../components/ScaledFrame";
import MenuBoard from "../templates/MenuBoard";
import Reveal from "../components/Reveal";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { planCheckoutPath, type BillingInterval } from "../lib/billingParams";
import { usePlatformSettings } from "../lib/usePlatformSettings";
import type { TemplateId } from "../lib/types";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const OLD_WAY = [
  "Redesign the menu file every time a price changes",
  "Update Clover inventory separately from your TVs",
  "Log into Uber Eats and DoorDash to fix the same item again",
  "So something's always wrong somewhere",
];

const NEW_WAY = [
  "Change the price on your phone or laptop",
  "Every screen updates in seconds — automatically",
  "Connected to Clover? Delivery apps follow too",
  "86'd an item? Toggle it off. Done everywhere.",
];

const CLOVER_FLOW = [
  {
    label: "You edit once",
    detail: "Prices, items, sold-outs — all in SyncMenu",
    accent: "bg-brand/10 text-brand",
  },
  {
    label: "TVs update live",
    detail: "Every menu board in your shop, instantly",
    accent: "bg-live/10 text-live",
  },
  {
    label: "Clover gets the push",
    detail: "Your POS menu stays matched",
    accent: "bg-amber/15 text-amber",
  },
  {
    label: "Delivery apps follow",
    detail: "Uber Eats, DoorDash & Grubhub when linked in Clover",
    accent: "bg-ink/5 text-ink",
  },
];

const DELIVERY_APPS = [
  { name: "Uber Eats", color: "#06C167" },
  { name: "DoorDash", color: "#FF3008" },
  { name: "Grubhub", color: "#F63440" },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Instant sync",
    body: "Change a price. It's on your screens in seconds. No USB sticks, no exports, no walking over to the TV.",
  },
  {
    icon: RefreshCw,
    title: "Clover + delivery sync",
    body: "Connect Clover and push menu changes from one place. Uber Eats, DoorDash, and Grubhub stay updated when they're linked through your Clover account.",
  },
  {
    icon: MonitorPlay,
    title: "Any screen with a browser",
    body: "Smart TVs, Google TV, tablets — if it opens a web page, it's a menu board. Pair it by scanning a QR code.",
  },
  {
    icon: Palette,
    title: "Templates + design studio",
    body: "Six professional looks, or design your own on a drag-and-drop canvas — fonts, photos, every color.",
  },
  {
    icon: ListVideo,
    title: "Playlists & rotation",
    body: "Rotate your main menu, lunch deals and specials on one screen with timed, animated slides.",
  },
  {
    icon: QrCode,
    title: "QR menus & ordering links",
    body: "One printable QR — customers get your live menu, dietary filters, Uber Eats & DoorDash buttons and socials.",
  },
  {
    icon: WifiOff,
    title: "Never goes dark",
    body: "Internet hiccup? Screens keep showing the last menu and reconnect on their own. No blank TVs at rush hour.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Build your menu",
    body: "Add sections and items, pick a template — or design your own. Photos, featured items, the lot.",
  },
  {
    n: "2",
    title: "Pair your TV",
    body: "Open one link on the TV browser and scan the QR code with your phone. Takes about a minute.",
  },
  {
    n: "3",
    title: "Connect Clover (optional)",
    body: "Already on Clover? Link your account and pick your delivery menu. Push once — POS and delivery apps follow.",
  },
  {
    n: "4",
    title: "Stay in sync",
    body: "Every edit goes live on screens, Clover, and delivery — instantly. Sold out? Price change? Two taps.",
  },
];

const HARDWARE = [
  {
    title: "Smart TV browser",
    tag: "Free — works right now",
    body: "Open one link in your TV's browser, press OK for fullscreen, scan the QR. Live in two minutes.",
    recommended: false,
  },
  {
    title: "Streaming stick + kiosk app",
    tag: "~$25 — the pro setup",
    body: "A Fire TV or Google TV stick running a kiosk browser: true fullscreen with zero browser bars, launches on power-on, recovers after power cuts.",
    recommended: true,
  },
  {
    title: "Tablet or Raspberry Pi",
    tag: "Use what's lying around",
    body: "Install the player as a fullscreen app on any tablet, or run a Pi in kiosk mode behind the TV.",
    recommended: false,
  },
];

const FAQS = [
  {
    q: "Do I need special hardware?",
    a: "No. Any TV, tablet or screen with a web browser works. For a rock-solid setup, most shops plug a ~$25 Fire TV or Google TV stick into the TV and run the player in a kiosk browser app — true fullscreen, starts by itself when the power comes on.",
  },
  {
    q: "What happens if my internet drops?",
    a: "Your screens keep displaying the last menu from local cache and reconnect automatically. They never go blank mid-service.",
  },
  {
    q: "Can it match my brand?",
    a: "Yes — every template takes your logo, colors, fonts and even background photos. Or build your own look in the design studio.",
  },
  {
    q: "How long does setup take?",
    a: "Most owners go from signup to a live menu on their TV in under 15 minutes. No designer, no IT person, no installer.",
  },
  {
    q: "I use Clover for POS and delivery. Does SyncMenu work with that?",
    a: "Yes. Connect your Clover account and choose which menu syncs to delivery. Edits in SyncMenu push to Clover — and if you've linked Uber Eats, DoorDash, or Grubhub inside Clover, those menus update too. Your TVs can show the same menu or a different one.",
  },
];

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

function demoSections(wingsPrice: number) {
  const item = (
    id: string,
    name: string,
    description: string,
    price: number,
    sort: number,
    featured = false
  ) => ({
    id,
    section_id: "",
    name,
    description,
    price,
    image_url: null,
    available: true,
    featured,
    sort_order: sort,
  });
  return [
    {
      id: "s1",
      menu_id: "demo",
      name: "Chicken",
      sort_order: 0,
      items: [
        item("i1", "6 Hot Wings", "Crispy, spicy, legendary", wingsPrice, 0, true),
        item("i2", "Fillet Burger", "Fresh lettuce & house mayo", 6.5, 1),
        item("i3", "Family Bucket", "10 pcs, 4 fries, 2 sides", 19.9, 2),
      ],
    },
    {
      id: "s2",
      menu_id: "demo",
      name: "Sides",
      sort_order: 1,
      items: [
        item("i4", "Peri Fries", "Dusted with peri-peri salt", 3.2, 0),
        item("i5", "Coleslaw", "Made fresh daily", 2.0, 1),
      ],
    },
  ];
}

const SHOWCASE: { id: TemplateId; label: string; accent: string }[] = [
  { id: "classic", label: "Classic", accent: "#FF6B2C" },
  { id: "bold", label: "Bold Board", accent: "#FF6B2C" },
  { id: "chalk", label: "Chalkboard", accent: "#FFB020" },
  { id: "luxe", label: "Night Luxe", accent: "#D4AF7A" },
  { id: "market", label: "Fresh Market", accent: "#22B573" },
  { id: "spotlight", label: "Spotlight", accent: "#1E3A5F" },
  { id: "vivid", label: "Vivid Zones", accent: "#E5484D" },
  { id: "promo", label: "Promo Hero", accent: "#3B82F6" },
  { id: "custom", label: "Your Design", accent: "#FF6B2C" },
];

/* ------------------------------------------------------------------ */

export default function Landing() {
  const [wingsPrice, setWingsPrice] = useState(5.9);
  const [pulse, setPulse] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const { config, plans } = usePlatformSettings();
  const sections = useMemo(() => demoSections(wingsPrice), [wingsPrice]);

  function changePrice() {
    setWingsPrice((p) => (p === 5.9 ? 4.9 : 5.9));
    setPulse(true);
    setTimeout(() => setPulse(false), 800);
  }

  const demoData = {
    restaurantName: "Big Bite Chicken",
    logoUrl: null,
    currency: "USD",
    menuName: "Our Menu",
    sections,
  };

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 text-center sm:px-6 sm:pb-24 sm:pt-16">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-mist bg-cloud px-4 py-1.5 text-xs font-medium text-smoke">
            <span className="h-1.5 w-1.5 rounded-full bg-live" />
            Menu boards + Clover delivery sync
          </span>
          <h1 className="font-display mx-auto mt-6 max-w-4xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-7xl">
            One menu.{" "}
            <span className="text-brand">Every screen.</span>{" "}
            Every delivery app.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-smoke">
            Update your menu once from your phone — it's live on every TV in your
            shop, pushed to Clover, and synced to Uber Eats, DoorDash, and Grubhub
            when they're connected through Clover. No USB sticks. No triple
            updates. No outdated prices at rush hour.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup" className="btn-primary px-7 py-3 text-base">
              Start free trial
            </Link>
            <button onClick={changePrice} className="btn-secondary px-7 py-3 text-base">
              See it live ↓
            </button>
          </div>
          <p className="mt-3 text-xs text-smoke">
            14 days free · No credit card to try it · Live in 15 minutes
          </p>
        </Reveal>

        {/* interactive TV demo */}
        <Reveal delay={120}>
          <div className="relative mx-auto mt-14 max-w-4xl">
            <div
              className={`overflow-hidden rounded-3xl border-8 border-ink bg-ink shadow-2xl transition-shadow ${
                pulse ? "sync-pulse" : ""
              }`}
            >
              <ScaledFrame designWidth={1920} designHeight={1080}>
                <MenuBoard
                  data={demoData}
                  templateId="bold"
                  config={{ accent: "#FF6B2C", theme: "light" }}
                  orientation="landscape"
                />
              </ScaledFrame>
            </div>
            <button
              onClick={changePrice}
              className="btn-primary absolute -bottom-5 left-1/2 w-max -translate-x-1/2 shadow-lg"
            >
              <Zap size={16} />
              Change the wings price — watch it sync
            </button>
          </div>
        </Reveal>
      </section>

      {/* clover + delivery sync */}
      <section id="clover" className="scroll-mt-20 border-y border-mist bg-cloud py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
                <Store size={14} />
                Clover integration
              </span>
              <h2 className="font-display mt-5 text-3xl font-bold md:text-4xl">
                Stop updating the same menu three times
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-smoke">
                Most shops run menu boards on TVs, a POS in Clover, and delivery
                on Uber Eats or DoorDash. SyncMenu ties them together — edit once,
                and everything stays matched.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CLOVER_FLOW.map((step, i) => (
              <Reveal key={step.label} delay={i * 80}>
                <div className="card lift relative h-full p-6">
                  {i < CLOVER_FLOW.length - 1 && (
                    <ArrowRight
                      size={18}
                      className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-smoke/40 lg:block"
                      aria-hidden
                    />
                  )}
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${step.accent}`}
                  >
                    Step {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{step.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-smoke">{step.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="card mx-auto mt-10 max-w-3xl p-8 text-center">
              <p className="text-sm font-medium text-smoke">
                When these are connected inside Clover, they sync from SyncMenu too
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {DELIVERY_APPS.map((app) => (
                  <span
                    key={app.name}
                    className="inline-flex items-center gap-2 rounded-full border border-mist bg-white px-4 py-2 text-sm font-medium"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: app.color }}
                    />
                    {app.name}
                  </span>
                ))}
              </div>
              <p className="mt-6 text-sm leading-relaxed text-smoke">
                Wings on special? 86 the coleslaw? Change it in SyncMenu — your TVs
                flip instantly, Clover gets the update, and delivery menus follow.
                One source of truth. Finally.
              </p>
              <Link to="/signup" className="btn-primary mt-6 inline-flex px-6 py-3">
                Try it with your menu
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* old way vs new way */}
      <section className="bg-cloud py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="font-display text-center text-3xl font-bold md:text-4xl">
              Still updating menus in three different places?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-smoke">
              The TV file, the Clover inventory, the DoorDash listing — they
              shouldn't be three separate jobs. Here's the difference:
            </p>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <Reveal>
              <div className="card lift h-full p-7">
                <p className="text-sm font-semibold uppercase tracking-wider text-alert">
                  The old way
                </p>
                <ul className="mt-4 space-y-3">
                  {OLD_WAY.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-smoke">
                      <X size={17} className="mt-0.5 shrink-0 text-alert" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="card lift h-full border-brand/30 p-7 ring-1 ring-brand/20">
                <p className="text-sm font-semibold uppercase tracking-wider text-brand">
                  With SyncMenu
                </p>
                <ul className="mt-4 space-y-3">
                  {NEW_WAY.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-live" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <Reveal>
          <h2 className="font-display text-center text-3xl font-bold md:text-4xl">
            Everything a busy shop needs — boards, Clover, delivery
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-smoke">
            Built for chicken shops, sandwich counters, and takeaways that run
            hard. Professional menus without a designer or an IT person.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={(i % 3) * 100}>
              <div className="card lift h-full p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
                  <Icon size={22} className="text-brand" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-smoke">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* template showcase */}
      <section className="bg-ink py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="font-display text-center text-3xl font-bold text-white md:text-4xl">
              Nine looks. Or design your own.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-white/60">
              Real templates from the product, rendered with a real menu. Your
              logo, your colors, your photos — without touching a design tool.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SHOWCASE.map((t, i) => (
              <Reveal key={t.id} delay={i * 120}>
                <div className="lift overflow-hidden rounded-2xl border-4 border-white/10 shadow-xl">
                  <ScaledFrame designWidth={1920} designHeight={1080}>
                    <MenuBoard
                      data={demoData}
                      templateId={t.id}
                      config={{ accent: t.accent }}
                      orientation="landscape"
                    />
                  </ScaledFrame>
                </div>
                <p className="mt-3 text-center text-sm font-medium text-white/80">
                  {t.label}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="font-display text-center text-3xl font-bold md:text-4xl">
            Live on your TV in minutes
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="text-center">
                <div className="font-display mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-smoke">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* hardware */}
      <section className="bg-cloud py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="font-display text-center text-3xl font-bold md:text-4xl">
              Runs on hardware you already have
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-smoke">
              No proprietary boxes, no installer visits. If it opens a web
              page, it's a menu board.
            </p>
          </Reveal>
          <div className="mt-12 grid items-stretch gap-6 md:grid-cols-3">
            {HARDWARE.map((h, i) => (
              <Reveal key={h.title} delay={i * 120}>
                <div
                  className={`card lift relative h-full p-7 ${
                    h.recommended ? "border-brand ring-2 ring-brand" : ""
                  }`}
                >
                  {h.recommended && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-white">
                      Recommended
                    </span>
                  )}
                  <h3 className="font-semibold">{h.title}</h3>
                  <p className="mt-0.5 text-xs font-medium text-brand">{h.tag}</p>
                  <p className="mt-3 text-sm leading-relaxed text-smoke">{h.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="font-display text-center text-3xl font-bold md:text-4xl">
              Simple pricing. Pick your screen plan.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-center text-smoke">
              Every core feature is included. Add Clover delivery sync only if you need it.
            </p>
          </Reveal>
          <BillingIntervalToggle
            value={billingInterval}
            onChange={setBillingInterval}
            className="mt-8"
          />
          <div className="mt-10 grid items-start gap-6 md:grid-cols-3">
            {plans.map((plan, i) => {
              const price =
                billingInterval === "yearly" ? plan.annualMonthly : plan.monthly;
              return (
              <Reveal key={plan.id} delay={i * 120}>
                <div
                  className={`card lift relative p-7 ${
                    plan.popular ? "border-brand ring-2 ring-brand md:-mt-3 md:pb-10" : ""
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <p className="font-semibold">{plan.name}</p>
                  <p className="mt-0.5 text-sm text-smoke">{plan.tagline}</p>
                  <p className="mt-4">
                    <span className="font-display text-4xl font-bold">${price}</span>
                    <span className="text-sm text-smoke">/month</span>
                  </p>
                  <p className="mt-0.5 text-xs text-smoke">
                    {billingInterval === "yearly"
                      ? `billed annually ($${plan.annualMonthly * 12}/yr)`
                      : `or ~$${plan.annualMonthly}/mo billed annually`}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-2.5 text-sm">
                        <Check size={15} className="shrink-0 text-live" /> {perk}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={planCheckoutPath(plan.id, billingInterval)}
                    className={`${plan.popular ? "btn-primary" : "btn-secondary"} mt-6 w-full`}
                  >
                    {billingInterval === "yearly"
                      ? `Get ${plan.name} — annual`
                      : `Get ${plan.name} — monthly`}
                  </Link>
                </div>
              </Reveal>
            );
            })}
          </div>
          <Reveal>
            <div className="mt-8 rounded-2xl border border-mist bg-cloud p-6 md:flex md:items-center md:justify-between md:gap-8">
              <div className="flex items-start gap-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Plug size={21} />
                </div>
                <div>
                  <p className="font-semibold">Clover delivery sync add-on</p>
                  <p className="mt-1 max-w-2xl text-pretty text-sm text-smoke">
                    Update one SyncMenu delivery menu and push changes to Clover inventory,
                    including connected delivery apps.
                  </p>
                </div>
              </div>
              <div className="mt-5 shrink-0 md:mt-0 md:text-right">
                <p className="tabular-nums">
                  <span className="font-display text-3xl font-bold">
                    $
                    {billingInterval === "yearly"
                      ? config.clover.pricing.annualMonthly
                      : config.clover.pricing.monthly}
                  </span>
                  <span className="text-sm text-smoke">/month</span>
                </p>
                <p className="mt-0.5 text-xs text-smoke">
                  {billingInterval === "yearly"
                    ? `billed annually ($${config.clover.pricing.annualMonthly * 12}/yr)`
                    : "added to your SyncMenu subscription"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {plans.map((plan) => (
                <Link
                  key={plan.id}
                  to={planCheckoutPath(plan.id, billingInterval, "clover")}
                  className="btn-secondary"
                >
                  {plan.name} + Clover
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <Reveal>
          <h2 className="font-display text-center text-3xl font-bold md:text-4xl">
            Questions owners actually ask
          </h2>
        </Reveal>
        <div className="mt-10 space-y-4">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 80}>
              <details className="card group p-5 open:pb-6">
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {f.q}
                    <span className="text-brand transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-smoke">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <div
            className="rounded-3xl px-8 py-14 text-center text-white"
            style={{ background: "linear-gradient(120deg, #FF6B2C 0%, #E4501A 100%)" }}
          >
            <h2 className="font-display text-3xl font-bold md:text-4xl">
              Your menu, finally in one place.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-white/85">
              TVs live tonight. Clover connected in minutes. Delivery apps that
              follow when you're ready. Start free — no credit card.
            </p>
            <Link
              to="/signup"
              className="mt-7 inline-flex items-center justify-center rounded-xl bg-white px-7 py-3 text-base font-medium text-ember transition-transform duration-200 hover:scale-[1.03]"
            >
              Start your 14-day free trial
            </Link>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}
