import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import SetupNotice from "../SetupNotice";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data.session) {
      // Email confirmation is enabled on the Supabase project
      setNeedsConfirm(true);
      return;
    }
    void supabase.functions.invoke("on-user-created", {
      body: {
        email,
        userId: data.user?.id,
        origin: window.location.origin,
      },
    });
    navigate("/onboarding", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo size={34} />
          </Link>
        </div>
        {needsConfirm ? (
          <div className="card p-8 text-center">
            <h1 className="text-xl font-semibold">Check your inbox</h1>
            <p className="mt-2 text-sm text-smoke">
              We sent a confirmation link to <strong>{email}</strong>. Click it,
              then come back and log in.
            </p>
            <Link to="/login" className="btn-primary mt-6 w-full">
              Go to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-8">
            <h1 className="text-xl font-semibold">Start your free trial</h1>
            <p className="mt-1 text-sm text-smoke">
              14 days free. No credit card needed to try it out.
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
                <label className="label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-smoke">At least 8 characters.</p>
              </div>
            </div>
            {error && <p className="mt-4 text-sm text-alert">{error}</p>}
            <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </button>
            <p className="mt-4 text-center text-sm text-smoke">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-brand hover:text-ember">
                Log in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
