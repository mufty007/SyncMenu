import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, type ReactNode } from "react";
import { useAuth } from "./context/AuthContext";
import { isSupabaseConfigured } from "./lib/supabase";
import SetupNotice from "./pages/SetupNotice";

// Route-level code splitting keeps the kiosk player bundle lean for
// low-powered smart-TV browsers (dashboard code never loads on the TV).
const Landing = lazy(() => import("./pages/Landing"));
const Contact = lazy(() => import("./pages/Contact"));
const Privacy = lazy(() => import("./pages/legal/Privacy"));
const Terms = lazy(() => import("./pages/legal/Terms"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Onboarding = lazy(() => import("./pages/auth/Onboarding"));
const DashboardLayout = lazy(() => import("./pages/dashboard/DashboardLayout"));
const MenusPage = lazy(() => import("./pages/dashboard/MenusPage"));
const MenuEditorPage = lazy(() => import("./pages/dashboard/MenuEditorPage"));
const ScreensPage = lazy(() => import("./pages/dashboard/ScreensPage"));
const PlaylistsPage = lazy(() => import("./pages/dashboard/PlaylistsPage"));
const PlaylistEditorPage = lazy(() => import("./pages/dashboard/PlaylistEditorPage"));
const SettingsPage = lazy(() => import("./pages/dashboard/SettingsPage"));
const BillingPage = lazy(() => import("./pages/dashboard/BillingPage"));
const PairConfirmPage = lazy(() => import("./pages/dashboard/PairConfirmPage"));
const StudioPage = lazy(() => import("./pages/studio/StudioPage"));
const PlayerPage = lazy(() => import("./pages/player/PlayerPage"));
const PublicMenuPage = lazy(() => import("./pages/PublicMenuPage"));
const HubPage = lazy(() => import("./pages/HubPage"));
const PublicPagePage = lazy(() => import("./pages/dashboard/PublicPagePage"));
const TvSetupPage = lazy(() => import("./pages/dashboard/TvSetupPage"));
const PrintQrPage = lazy(() => import("./pages/PrintQrPage"));
const PlatformLayout = lazy(() => import("./pages/platform/PlatformLayout"));
const PlatformOverviewPage = lazy(() => import("./pages/platform/PlatformOverviewPage"));
const TenantsPage = lazy(() => import("./pages/platform/TenantsPage"));
const TenantDetailPage = lazy(() => import("./pages/platform/TenantDetailPage"));
const PlatformBillingPage = lazy(() => import("./pages/platform/PlatformBillingPage"));
const EmailsPage = lazy(() => import("./pages/platform/EmailsPage"));
const PlatformSettingsPage = lazy(() => import("./pages/platform/PlatformSettingsPage"));
const AdminsPage = lazy(() => import("./pages/platform/AdminsPage"));
const AuditPage = lazy(() => import("./pages/platform/AuditPage"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage"));

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-mist border-t-brand" />
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { session, restaurant, isPlatformAdmin, loading } = useAuth();
  const location = useLocation();
  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <Spinner />;
  if (!session) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" state={{ from }} replace />;
  }
  if (!restaurant && location.pathname !== "/onboarding") {
    if (isPlatformAdmin) {
      return <Navigate to="/platform" replace />;
    }
    const onboardingPath = location.pathname.startsWith("/app/billing")
      ? `/onboarding${location.search}`
      : "/onboarding";
    return <Navigate to={onboardingPath} replace />;
  }
  return <>{children}</>;
}

function PlatformProtected({ children }: { children: ReactNode }) {
  const { session, isPlatformAdmin, loading } = useAuth();
  const location = useLocation();
  if (!isSupabaseConfigured) return <SetupNotice />;
  if (loading) return <Spinner />;
  if (!session) {
    const from = location.pathname + location.search;
    return <Navigate to="/login" state={{ from }} replace />;
  }
  if (!isPlatformAdmin) {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}

/** Scrolls to #hash targets after SPA navigations (e.g. /#pricing from the footer). */
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <ScrollToHash />
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/onboarding"
        element={
          <Protected>
            <Onboarding />
          </Protected>
        }
      />
      <Route
        path="/studio/:menuId"
        element={
          <Protected>
            <StudioPage />
          </Protected>
        }
      />
      <Route
        path="/pair/:code"
        element={
          <Protected>
            <PairConfirmPage />
          </Protected>
        }
      />
      <Route
        path="/app"
        element={
          <Protected>
            <DashboardLayout />
          </Protected>
        }
      >
        <Route index element={<Navigate to="/app/menus" replace />} />
        <Route path="menus" element={<MenusPage />} />
        <Route path="menus/:menuId" element={<MenuEditorPage />} />
        <Route path="screens" element={<ScreensPage />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="playlists/:playlistId" element={<PlaylistEditorPage />} />
        <Route path="public" element={<PublicPagePage />} />
        <Route path="setup-tv" element={<TvSetupPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>
      <Route
        path="/app/print-qr/:format"
        element={
          <Protected>
            <PrintQrPage />
          </Protected>
        }
      />
      <Route path="/unsubscribe" element={<UnsubscribePage />} />
      <Route
        path="/platform"
        element={
          <PlatformProtected>
            <PlatformLayout />
          </PlatformProtected>
        }
      >
        <Route index element={<PlatformOverviewPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="tenants/:id" element={<TenantDetailPage />} />
        <Route path="billing" element={<PlatformBillingPage />} />
        <Route path="emails" element={<EmailsPage />} />
        <Route path="settings" element={<PlatformSettingsPage />} />
        <Route path="admins" element={<AdminsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
      <Route path="/play" element={<PlayerPage />} />
      <Route path="/m/:menuId" element={<PublicMenuPage />} />
      <Route path="/r/:restaurantId" element={<HubPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
