import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  CreditCard,
  Globe,
  HelpCircle,
  LayoutGrid,
  ListVideo,
  LogOut,
  MonitorPlay,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
} from "lucide-react";
import Logo, { SyncIcon } from "../../components/Logo";
import AppShell from "../../components/AppShell";
import Walkthrough from "../../components/Walkthrough";
import { useAuth } from "../../context/AuthContext";
import { trialDaysLeft } from "../../lib/format";

const TOUR_KEY = "syncmenu.tour";
const COLLAPSE_KEY = "syncmenu.sidebar-collapsed";

const NAV = [
  { to: "/app/menus", label: "Menus", icon: LayoutGrid },
  { to: "/app/screens", label: "Screens", icon: MonitorPlay },
  { to: "/app/playlists", label: "Playlists", icon: ListVideo },
  { to: "/app/public", label: "Public page", icon: Globe },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
];

export default function DashboardLayout() {
  const { restaurant, signOut, isPlatformAdmin } = useAuth();
  const daysLeft = restaurant ? trialDaysLeft(restaurant.trial_ends_at) : 0;
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY) === "pending") {
      const t = setTimeout(() => setTourOpen(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  function closeTour() {
    localStorage.setItem(TOUR_KEY, "done");
    setTourOpen(false);
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  }

  const trialText =
    daysLeft > 0 ? (
      <>
        <strong>
          {daysLeft} day{daysLeft === 1 ? "" : "s"}
        </strong>{" "}
        left in your free trial.
      </>
    ) : null;

  const footer = (
    <>
      <p className="truncate px-1 text-sm font-medium">{restaurant?.name}</p>
      {isPlatformAdmin && (
        <NavLink to="/platform" className="btn-ghost mt-1 w-full justify-start">
          <Shield size={16} className="shrink-0" />
          Platform console
        </NavLink>
      )}
      <button onClick={() => setTourOpen(true)} className="btn-ghost mt-1 w-full justify-start">
        <HelpCircle size={16} className="shrink-0" />
        Take the tour
      </button>
      <button onClick={() => void signOut()} className="btn-ghost mt-1 w-full justify-start">
        <LogOut size={16} className="shrink-0" />
        Sign out
      </button>
    </>
  );

  return (
    <>
      {/* Mobile + tablet: drawer shell */}
      <div className="lg:hidden">
        <AppShell brand={<Logo size={26} />} nav={NAV} footer={footer} variant="light">
          {trialText && (
            <div className="-mx-4 -mt-4 mb-4 border-b border-amber/30 bg-amber/10 px-4 py-2 text-sm text-ink sm:-mx-6 sm:px-6">
              {trialText}
            </div>
          )}
          <Outlet />
        </AppShell>
      </div>

      {/* Desktop: collapsible sidebar */}
      <div className="hidden lg:flex">
        <aside
          className={`sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden border-r border-mist bg-white transition-[width] duration-200 ${
            collapsed ? "w-[68px] p-3" : "w-60 p-4"
          }`}
        >
          <div
            className={`flex items-center py-2 ${
              collapsed ? "flex-col gap-3" : "justify-between px-2"
            }`}
          >
            {collapsed ? <SyncIcon size={30} /> : <Logo size={26} />}
            <button
              onClick={toggleCollapsed}
              className="btn-ghost px-1.5 py-1.5"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>

          <nav className="mt-4 flex flex-1 flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={label}
                data-tour={label}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                    collapsed ? "justify-center px-0" : "px-3"
                  } ${
                    isActive
                      ? "bg-brand/10 text-brand"
                      : "text-smoke hover:bg-cloud hover:text-ink"
                  }`
                }
              >
                <Icon size={18} strokeWidth={2} className="shrink-0" />
                {!collapsed && label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-mist pt-3">
            {!collapsed ? (
              footer
            ) : (
              <div className="flex flex-col items-center gap-1">
                {isPlatformAdmin && (
                  <NavLink to="/platform" title="Platform console" className="btn-ghost px-1.5">
                    <Shield size={16} />
                  </NavLink>
                )}
                <button onClick={() => void signOut()} title="Sign out" className="btn-ghost px-1.5">
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="min-h-screen min-w-0 flex-1">
          {trialText && (
            <div className="border-b border-amber/30 bg-amber/10 px-8 py-2 text-sm text-ink">
              {trialText}
            </div>
          )}
          <div className="mx-auto max-w-6xl p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {tourOpen && <Walkthrough onClose={closeTour} />}
    </>
  );
}
