import { NavLink, Outlet } from "react-router-dom";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  ScrollText,
  Shield,
  Users,
} from "lucide-react";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { to: "/platform", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/platform/tenants", label: "Tenants", icon: Building2 },
  { to: "/platform/billing", label: "Billing", icon: CreditCard },
  { to: "/platform/emails", label: "Emails", icon: Mail },
  { to: "/platform/admins", label: "Admins", icon: Shield },
  { to: "/platform/audit", label: "Audit log", icon: ScrollText },
];

export default function PlatformLayout() {
  const { signOut, session } = useAuth();

  return (
    <div className="flex min-h-screen bg-cloud">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-mist bg-ink p-4 text-white">
        <div className="px-2 py-2">
          <Logo variant="white" size={26} />
          <p className="mt-2 text-xs font-medium uppercase tracking-wider text-white/50">
            Platform console
          </p>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 pt-3">
          <p className="truncate px-3 text-xs text-white/50">{session?.user.email}</p>
          <NavLink
            to="/app/menus"
            className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            <Users size={16} /> Owner dashboard
          </NavLink>
          <button
            onClick={() => void signOut()}
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
