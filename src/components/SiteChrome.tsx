import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";

const MOBILE_LINKS = [
  { to: "/#features", label: "Features" },
  { to: "/#clover", label: "Clover sync" },
  { to: "/#pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-mist/60 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" onClick={() => setOpen(false)}>
          <Logo size={30} />
        </Link>

        <nav className="hidden items-center gap-1 sm:flex sm:gap-2">
          <Link to="/#features" className="btn-ghost">
            Features
          </Link>
          <Link to="/#clover" className="btn-ghost">
            Clover sync
          </Link>
          <Link to="/#pricing" className="btn-ghost">
            Pricing
          </Link>
          <Link to="/contact" className="btn-ghost">
            Contact
          </Link>
          <Link to="/login" className="btn-ghost">
            Log in
          </Link>
          <Link to="/signup" className="btn-primary">
            Start free trial
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <Link to="/signup" className="btn-primary px-3 py-2 text-xs">
            Try free
          </Link>
          <button
            type="button"
            className="btn-ghost px-2 py-2"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-mist bg-white px-4 py-3 sm:hidden">
          <ul className="space-y-1">
            {MOBILE_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-cloud"
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/login"
                className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-cloud"
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-mist bg-cloud">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo size={24} />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-smoke">
            Digital menu boards for independent restaurants. Update once —
            every screen updates instantly.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-smoke">
            <li>
              <Link to="/#features" className="hover:text-brand">
                Features
              </Link>
            </li>
            <li>
              <Link to="/#pricing" className="hover:text-brand">
                Pricing
              </Link>
            </li>
            <li>
              <Link to="/signup" className="hover:text-brand">
                Start free trial
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-brand">
                Log in
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-smoke">
            <li>
              <Link to="/contact" className="hover:text-brand">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-brand">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-brand">
                Terms of service
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Get started</p>
          <p className="mt-3 text-sm text-smoke">
            Live on your TV in under 15 minutes.
          </p>
          <Link to="/signup" className="btn-primary mt-4">
            Start free trial
          </Link>
        </div>
      </div>
      <div className="border-t border-mist/60">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-smoke sm:px-6">
          Menus in sync. © {new Date().getFullYear()} SyncMenu
        </p>
      </div>
    </footer>
  );
}
