import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import Logo from "../../components/Logo";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function StudioSetup() {
  const { session, studio, isDesigner, refreshRestaurant } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");

  if (!session) return <Navigate to="/login" replace />;
  if (studio) {
    return <Navigate to={inviteToken ? `/invite/${inviteToken}` : "/studio"} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("create_studio", { p_name: name.trim() });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await refreshRestaurant();
    navigate(inviteToken ? `/invite/${inviteToken}` : "/studio", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size={34} />
        </div>
        <form onSubmit={handleSubmit} className="card p-8">
          <h1 className="text-xl font-semibold">Name your studio</h1>
          <p className="mt-1 text-sm text-smoke">
            {isDesigner
              ? "This is the workspace you use to design menus for restaurants. It's free."
              : "Design menus for restaurants from here. The platform is free for you — we bill each restaurant."}
          </p>
          <div className="mt-6">
            <label className="label" htmlFor="studio-name">
              Studio name
            </label>
            <input
              id="studio-name"
              required
              autoFocus
              className="input"
              placeholder="e.g. Northside Menu Co."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className="mt-4 text-sm text-alert">{error}</p>}
          <button type="submit" className="btn-primary mt-6 w-full" disabled={busy || name.trim().length < 2}>
            {busy ? "Creating…" : "Create studio"}
          </button>
        </form>
      </div>
    </div>
  );
}
