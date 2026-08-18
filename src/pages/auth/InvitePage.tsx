import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Logo from "../../components/Logo";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import SetupNotice from "../SetupNotice";

export default function InvitePage() {
  const { token } = useParams();
  const { session, loading, refreshRestaurant, studio } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<{
    ok: boolean;
    error?: string;
    role?: string;
    email?: string;
    restaurant_name?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void supabase.rpc("get_invite_preview", { p_token: token }).then(({ data }) => {
      setPreview(data as typeof preview);
    });
  }, [token]);

  useEffect(() => {
    if (loading || !session || !token || !preview?.ok) return;
    if (preview.role === "designer" && !studio) {
      navigate(`/studio/setup?invite=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [loading, session, studio, token, preview, navigate]);

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("accept_invite", { p_token: token });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshRestaurant();
    const restaurantId = (data as { restaurant_id?: string } | null)?.restaurant_id;
    const role = (data as { role?: string } | null)?.role;
    if (role === "designer") {
      navigate("/studio", { replace: true });
    } else {
      if (restaurantId) {
        localStorage.setItem("syncmenu.activeRestaurantId", restaurantId);
      }
      navigate("/app/menus", { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo size={34} />
          </Link>
        </div>
        <div className="card p-8">
          {!preview ? (
            <p className="text-sm text-smoke">Loading invite…</p>
          ) : !preview.ok ? (
            <>
              <h1 className="text-xl font-semibold">Invite unavailable</h1>
              <p className="mt-2 text-sm text-smoke">{preview.error}</p>
              <Link to="/login" className="btn-primary mt-6 w-full">
                Go to login
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">You&apos;re invited</h1>
              <p className="mt-2 text-sm text-smoke">
                Join <strong>{preview.restaurant_name}</strong> as{" "}
                {preview.role === "designer" ? "their menu designer" : "the restaurant operator"}
                {preview.email ? ` (${preview.email})` : ""}.
              </p>
              {loading ? (
                <p className="mt-6 text-sm text-smoke">Checking your session…</p>
              ) : session ? (
                <>
                  {error && <p className="mt-4 text-sm text-alert">{error}</p>}
                  <button
                    className="btn-primary mt-6 w-full"
                    disabled={busy}
                    onClick={() => void accept()}
                  >
                    {busy ? "Accepting…" : "Accept invite"}
                  </button>
                </>
              ) : (
                <div className="mt-6 space-y-3">
                  <Link
                    to={`/signup?${new URLSearchParams({
                      type: preview.role === "designer" ? "designer" : "restaurant",
                      invite: token ?? "",
                    }).toString()}`}
                    className="btn-primary w-full"
                  >
                    Create an account
                  </Link>
                  <Link
                    to="/login"
                    state={{ from: `/invite/${token}` }}
                    className="btn-secondary w-full"
                  >
                    I already have an account
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
