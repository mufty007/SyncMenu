import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X, type LucideIcon } from "lucide-react";

export interface ShellNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface AppShellProps {
  brand: ReactNode;
  nav: ShellNavItem[];
  footer: ReactNode;
  children: ReactNode;
  /** Dark sidebar (platform console). */
  variant?: "light" | "dark";
  /** Extra class on the desktop sidebar width container. */
  sidebarClassName?: string;
}

function navClass(isActive: boolean, dark: boolean) {
  if (dark) {
    return isActive
      ? "bg-brand text-white"
      : "text-white/70 hover:bg-white/10 hover:text-white";
  }
  return isActive
    ? "bg-brand/10 text-brand"
    : "text-smoke hover:bg-cloud hover:text-ink";
}

function ShellLink({
  item,
  dark,
  onNavigate,
}: {
  item: ShellNavItem;
  dark: boolean;
  onNavigate?: () => void;
}) {
  const { to, label, icon: Icon, end } = item;
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${navClass(isActive, dark)}`
      }
    >
      <Icon size={18} strokeWidth={2} className="shrink-0" />
      {label}
    </NavLink>
  );
}

export default function AppShell({
  brand,
  nav,
  footer,
  children,
  variant = "light",
  sidebarClassName = "w-60",
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dark = variant === "dark";

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const asideBg = dark ? "bg-ink text-white border-mist/20" : "bg-white border-mist";
  const close = () => setDrawerOpen(false);

  return (
    <div className="min-h-screen bg-cloud lg:flex">
      {/* Mobile top bar */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden ${asideBg}`}
      >
        {brand}
        <button
          type="button"
          className="btn-ghost px-2 py-2"
          aria-label={drawerOpen ? "Close menu" : "Open menu"}
          onClick={() => setDrawerOpen((o) => !o)}
        >
          {drawerOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          aria-label="Close menu"
          onClick={close}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,17rem)] flex-col border-r p-4 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shrink-0 ${asideBg} ${sidebarClassName} ${
          drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="mb-4">{brand}</div>
        <nav className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto lg:mt-6">
          {nav.map((item) => (
            <ShellLink key={item.to} item={item} dark={dark} onNavigate={close} />
          ))}
        </nav>
        <div className={`border-t pt-3 ${dark ? "border-white/10" : "border-mist"}`}>
          {footer}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
