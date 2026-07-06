import { Link } from "react-router-dom";
import Logo from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-mist/60 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/">
          <Logo size={30} />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link to="/#features" className="btn-ghost hidden sm:inline-flex">
            Features
          </Link>
          <Link to="/#pricing" className="btn-ghost hidden sm:inline-flex">
            Pricing
          </Link>
          <Link to="/contact" className="btn-ghost hidden sm:inline-flex">
            Contact
          </Link>
          <Link to="/login" className="btn-ghost">
            Log in
          </Link>
          <Link to="/signup" className="btn-primary">
            Start free trial
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-mist bg-cloud">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
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
        <p className="mx-auto max-w-6xl px-6 py-5 text-xs text-smoke">
          Menus in sync. © {new Date().getFullYear()} SyncMenu
        </p>
      </div>
    </footer>
  );
}
