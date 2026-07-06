import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import Logo from "../../components/Logo";
import { supabase } from "../../lib/supabase";
import type { Orientation } from "../../lib/types";

export default function PairConfirmPage() {
  const { code } = useParams();
  const [name, setName] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("claim_pairing_session", {
      p_code: code,
      p_name: name || "New screen",
      p_orientation: orientation,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size={34} />
        </div>
        {done ? (
          <div className="card p-8 text-center">
            <CheckCircle2 size={40} className="mx-auto text-live" />
            <h1 className="mt-4 text-xl font-semibold">Screen paired!</h1>
            <p className="mt-2 text-sm text-smoke">
              Your TV is connecting now. Assign it a menu or playlist and it
              goes live instantly.
            </p>
            <Link to="/app/screens" className="btn-primary mt-6 w-full">
              Go to screens
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-8">
            <h1 className="text-xl font-semibold">Pair this screen</h1>
            <p className="mt-1 text-sm text-smoke">
              Pairing code: <span className="font-mono font-semibold text-ink">{code}</span>
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="screen-name">
                  Screen name
                </label>
                <input
                  id="screen-name"
                  className="input"
                  placeholder="e.g. Counter TV"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <p className="label">Orientation</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["landscape", "portrait"] as Orientation[]).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOrientation(o)}
                      className={`rounded-xl border px-2 py-2.5 text-sm font-medium capitalize transition-colors ${
                        orientation === o
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-mist text-smoke hover:border-smoke/40"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {error && <p className="mt-4 text-sm text-alert">{error}</p>}
            <button type="submit" className="btn-primary mt-6 w-full" disabled={busy}>
              {busy ? "Pairing…" : "Confirm & pair"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
