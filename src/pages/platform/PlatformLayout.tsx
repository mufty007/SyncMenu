import { NavLink, Outlet } from "react-router-dom";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Mail,
  Plug,
  ScrollText,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import Logo from "../../components/Logo";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { to: "/platform", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/platform/tenants", label: "Restaurants", icon: Building2 },
  { to: "/platform/billing", label: "Billing", icon: CreditCard },
  { to: "/platform/emails", label: "Emails", icon: Mail },
  { to: "/platform/integrations", label: "Integrations", icon: Plug },
  { to: "/platform/settings", label: "Settings", icon: Settings },
  { to: "/platform/admins", label: "Admins", icon: Shield },
  { to: "/platform/audit", label: "Audit log", icon: ScrollText },
];

export default function PlatformLayout() {
  const { signOut, session } = useAuth();

  const brand = (
    <div className="px-1 py-1">
      <Logo variant="white" size={26} />
      <p className="mt-2 text-xs font-medium uppercase tracking-wider text-white/50">
        Platform console
      </p>
    </div>
  );

  const footer = (
    <>
      <p className="truncate px-1 text-xs text-white/50">{session?.user.email}</p>
      <NavLink
        to="/app/menus"
        className="mt-2 flex items-center gap-2 rounded-xl px-1 py-2 text-sm text-white/70 hover:bg-white/10"
      >
        <Users size={16} /> Owner dashboard
      </NavLink>
      <button
        onClick={() => void signOut()}
        className="mt-1 flex w-full items-center gap-2 rounded-xl px-1 py-2 text-sm text-white/70 hover:bg-white/10"
      >
        <LogOut size={16} /> Sign out
      </button>
    </>
  );

  return (
    <AppShell brand={brand} nav={NAV} footer={footer} variant="dark">
      <Outlet />
    </AppShell>
  );
}
