import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Logo from "../../components/Logo";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import SetupNotice from "../SetupNotice";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured) return <SetupNotice />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link to="/">
            <Logo size={34} />
          </Link>
        </div>
        {sent ? (
          <div className="card p-8 text-center">
            <h1 className="text-xl font-semibold">Check your inbox</h1>
            <p className="mt-2 text-sm text-smoke">
              If an account exists for <strong>{email}</strong>, we've sent a
              link to reset your password. It expires after a short while, so
              use it soon.
            </p>
            <Link to="/login" className="btn-secondary mt-6 w-full">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-8">
            <h1 className="text-xl font-semibold">Reset your password</h1>
            <p className="mt-1 text-sm text-smoke">
              Enter your account email and we'll send you a reset link.
            </p>
            <div className="mt-6">
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
            {error && <p className="mt-4 text-sm text-alert">{error}</p>}
            <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <p className="mt-4 text-center text-sm text-smoke">
              Remembered it?{" "}
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
