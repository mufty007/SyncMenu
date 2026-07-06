import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import SetupNotice from "../SetupNotice";

/**
 * Landing page for the password-recovery email link. Supabase signs the
 * user in with a temporary recovery session; we just set the new password.
 */
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate("/app", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo size={34} />
          </Link>
        </div>
        {loading ? (
          <div className="card p-8 text-center text-sm text-smoke">Loading…</div>
        ) : !session ? (
          <div className="card p-8 text-center">
            <h1 className="text-xl font-semibold">Link expired</h1>
            <p className="mt-2 text-sm text-smoke">
              This reset link is invalid or has expired. Request a fresh one
              and try again.
            </p>
            <Link to="/forgot-password" className="btn-primary mt-6 w-full">
              Request new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-8">
            <h1 className="text-xl font-semibold">Choose a new password</h1>
            <p className="mt-1 text-sm text-smoke">
              You're signed in via the reset link — set your new password below.
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
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
              <div>
                <label className="label" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            {error && <p className="mt-4 text-sm text-alert">{error}</p>}
            <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
