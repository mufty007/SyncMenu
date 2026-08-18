import { Link } from "react-router-dom";
import { Check, Palette, Store, Wallet } from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import Reveal from "../components/Reveal";

const STEPS = [
  {
    icon: Store,
    title: "Add restaurants",
    body: "Create a client in your studio, pick a template or open the freeform canvas, and design every board they need.",
  },
  {
    icon: Palette,
    title: "You keep the design",
    body: "Templates, Studio, playlists, and brand stay with you. The shop edits items, prices, and pairs TVs on site.",
  },
  {
    icon: Wallet,
    title: "They pay SyncMenu",
    body: "The studio is free. Each restaurant subscribes from $15/month for two screens. You never put a card on file.",
  },
];

export default function ForDesigners() {
  return (
    <div>
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              For menu designers
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight text-ink sm:text-6xl">
              Design the boards. Let the restaurant run the shop.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg text-smoke">
              SyncMenu is free for studios. Add your restaurant clients, design
              their menus, and invite the owner with limited access — they pay
              a monthly restaurant fee, not you.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup?type=designer" className="btn-primary px-7 py-3 text-base">
                Create a free studio
              </Link>
              <Link to="/login" className="btn-secondary px-7 py-3 text-base">
                Log in
              </Link>
            </div>
          </Reveal>
        </section>

        <section className="border-y border-mist bg-cloud">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-3">
            {STEPS.map((step) => (
              <Reveal key={step.title}>
                <div className="card h-full p-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <step.icon size={20} />
                  </div>
                  <h2 className="mt-4 font-semibold">{step.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-smoke">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="card p-8 sm:p-12">
            <h2 className="font-display text-3xl font-bold">Partner pricing for their shop</h2>
            <p className="mt-2 max-w-xl text-smoke">
              Same product, a little more screen room — designed shops usually have a counter and a kitchen.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "$15 / month — 2 screens",
                "$30 / month — up to 6 screens",
                "$99 / month — up to 12 screens",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <Check size={16} className="text-live" /> {line}
                </li>
              ))}
            </ul>
            <Link to="/signup?type=designer" className="btn-primary mt-8 inline-flex">
              Start designing free
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
