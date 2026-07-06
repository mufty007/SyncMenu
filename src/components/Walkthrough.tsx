import { useEffect, useMemo, useState } from "react";

interface TourStep {
  target: string;
  title: string;
  body: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="Menus"]',
    title: "Menus",
    body: "Build your menu boards here — sections, items, prices, photos and the design. We already made you a starter menu.",
  },
  {
    target: '[data-tour="Screens"]',
    title: "Screens",
    body: "Pair any TV or tablet by opening one link and scanning a QR code. Then choose what each screen displays.",
  },
  {
    target: '[data-tour="Playlists"]',
    title: "Playlists",
    body: "Rotate two or more boards on one screen — main menu, lunch deals, specials — with timed slides.",
  },
  {
    target: '[data-tour="Public page"]',
    title: "Your QR page",
    body: "One printable QR code gives customers your live menu, ordering links and social profiles.",
  },
  {
    target: '[data-tour="new-menu"]',
    title: "Start here",
    body: "Open your starter menu or create a new one. Every change you save appears on your screens within seconds.",
  },
];

const CARD_W = 300;

/** Lightweight spotlight tour over the dashboard. */
export default function Walkthrough({ onClose }: { onClose: () => void }) {
  // only keep steps whose targets exist right now
  const steps = useMemo(
    () => TOUR_STEPS.filter((s) => document.querySelector(s.target)),
    []
  );
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[index];

  useEffect(() => {
    if (!step) return;
    function measure() {
      const el = document.querySelector(step.target);
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ block: "nearest" });
      setRect(el.getBoundingClientRect());
    }
    measure();
    window.addEventListener("resize", measure);
    const t = window.setTimeout(measure, 250); // after any scroll settles
    return () => {
      window.removeEventListener("resize", measure);
      window.clearTimeout(t);
    };
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < steps.length - 1) setIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, steps.length, onClose]);

  if (!step || !rect) return null;

  const pad = 6;
  // place the card right of the target when there's room, otherwise below
  const spaceRight = window.innerWidth - rect.right;
  const cardLeft =
    spaceRight > CARD_W + 40
      ? rect.right + 16
      : Math.min(Math.max(16, rect.left), window.innerWidth - CARD_W - 16);
  const cardTop =
    spaceRight > CARD_W + 40
      ? Math.min(Math.max(16, rect.top - 8), window.innerHeight - 220)
      : Math.min(rect.bottom + 14, window.innerHeight - 220);

  return (
    <div className="fixed inset-0 z-[60]">
      {/* spotlight */}
      <div
        className="absolute rounded-xl transition-all duration-300 ease-out"
        style={{
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(15,19,24,0.6)",
          border: "2px solid #FF6B2C",
        }}
      />
      {/* click-catcher so clicks don't land on the page */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* tooltip card */}
      <div
        className="absolute rounded-2xl bg-white p-5 shadow-2xl transition-all duration-300 ease-out"
        style={{ left: cardLeft, top: cardTop, width: CARD_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">
          {index + 1} / {steps.length}
        </p>
        <h3 className="mt-1 font-semibold">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-smoke">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button className="btn-ghost px-2 py-1.5 text-xs" onClick={onClose}>
            Skip tour
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setIndex(index - 1)}
              >
                Back
              </button>
            )}
            {index < steps.length - 1 ? (
              <button
                className="btn-primary px-4 py-1.5 text-xs"
                onClick={() => setIndex(index + 1)}
              >
                Next
              </button>
            ) : (
              <button className="btn-primary px-4 py-1.5 text-xs" onClick={onClose}>
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
