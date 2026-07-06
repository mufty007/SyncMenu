import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { resolvePostAuthPath } from "../../lib/authRedirect";
import SetupNotice from "../SetupNotice";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const from = (location.state as { from?: string } | null)?.from;
    const dest = await resolvePostAuthPath(from);
    navigate(dest, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo size={34} />
          </Link>
        </div>
        <form onSubmit={handleSubmit} className="card p-8">
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-smoke">
            Log in to manage your menus and screens.
          </p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label className="label" htmlFor="password">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-brand hover:text-ember"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-alert">{error}</p>}
          <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
          <p className="mt-4 text-center text-sm text-smoke">
            New to SyncMenu?{" "}
            <Link to="/signup" className="font-medium text-brand hover:text-ember">
              Start your free trial
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
