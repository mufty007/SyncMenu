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
} from "lucide-react";
import Logo, { SyncIcon } from "../../components/Logo";
import Walkthrough from "../../components/Walkthrough";
import { useAuth } from "../../context/AuthContext";
import { trialDaysLeft } from "../../lib/format";

const TOUR_KEY = "syncmenu.tour";

const NAV = [
  { to: "/app/menus", label: "Menus", icon: LayoutGrid },
  { to: "/app/screens", label: "Screens", icon: MonitorPlay },
  { to: "/app/playlists", label: "Playlists", icon: ListVideo },
  { to: "/app/public", label: "Public page", icon: Globe },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
];

const COLLAPSE_KEY = "syncmenu.sidebar-collapsed";

export default function DashboardLayout() {
  const { restaurant, signOut } = useAuth();
  const daysLeft = restaurant ? trialDaysLeft(restaurant.trial_ends_at) : 0;
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const [tourOpen, setTourOpen] = useState(false);

  // auto-start the tour once, right after onboarding
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

  return (
    <div className="flex">
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
                `flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors duration-150 ${
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
          {!collapsed && (
            <p className="truncate px-3 text-sm font-medium">{restaurant?.name}</p>
          )}
          <button
            onClick={() => setTourOpen(true)}
            title="Take the tour"
            className={`btn-ghost mt-1 w-full ${
              collapsed ? "justify-center px-0" : "justify-start"
            }`}
          >
            <HelpCircle size={16} className="shrink-0" />
            {!collapsed && "Take the tour"}
          </button>
          <button
            onClick={() => void signOut()}
            title="Sign out"
            className={`btn-ghost mt-1 w-full ${
              collapsed ? "justify-center px-0" : "justify-start"
            }`}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {tourOpen && <Walkthrough onClose={closeTour} />}

      <main className="min-h-screen min-w-0 flex-1">
        {daysLeft > 0 && (
          <div className="border-b border-amber/30 bg-amber/10 px-8 py-2 text-sm text-ink">
            <strong>
              {daysLeft} day{daysLeft === 1 ? "" : "s"}
            </strong>{" "}
            left in your free trial.
          </div>
        )}
        <div className="mx-auto max-w-6xl p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
