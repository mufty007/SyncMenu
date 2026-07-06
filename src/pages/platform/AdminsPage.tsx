import { useEffect, useState } from "react";
import { Shield, UserMinus, UserPlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { PageHeader } from "./ui";

interface AdminRow {
  user_id: string;
  email: string;
  created_at: string;
}

export default function AdminsPage() {
  const { session } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.rpc("admin_list_admins");
    setAdmins((data as AdminRow[]) ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addAdmin() {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.rpc("admin_manage_admin", {
      p_action: "add",
      p_email: email.trim(),
    });
    setBusy(false);
    if (err) setError(err.message);
    else {
      setEmail("");
      void load();
    }
  }

  async function removeAdmin(adminEmail: string) {
    if (!confirm(`Remove ${adminEmail} as platform admin?`)) return;
    const { error: err } = await supabase.rpc("admin_manage_admin", {
      p_action: "remove",
      p_email: adminEmail,
    });
    if (err) setError(err.message);
    else void load();
  }

  const atLimit = admins.length >= 3;

  return (
    <div>
      <PageHeader
        title="Platform admins"
        subtitle="Up to 3 super admins can manage the platform."
      />

      <div className="card mt-8 p-6">
        <h2 className="font-semibold">Add admin</h2>
        <p className="mt-1 text-sm text-smoke">
          They must already have a SyncMenu account.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            type="email"
            className="input max-w-sm"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={atLimit}
          />
          <button
            className="btn-primary"
            onClick={() => void addAdmin()}
            disabled={!email || busy || atLimit}
          >
            <UserPlus size={16} /> Add
          </button>
        </div>
        {atLimit && (
          <p className="mt-2 text-sm text-smoke">
            Admin limit reached — remove one before adding another.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-alert">{error}</p>}
      </div>

      <div className="card mt-6 divide-y divide-mist">
        {admins.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <Shield size={28} className="text-smoke/50" />
            <p className="mt-3 text-sm text-smoke">No admins yet.</p>
          </div>
        ) : (
          admins.map((a) => {
            const isSelf = a.email === session?.user.email;
            return (
              <div key={a.user_id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <Shield size={16} />
                  </span>
                  <div>
                    <p className="font-medium">
                      {a.email}
                      {isSelf && (
                        <span className="ml-2 rounded-full bg-mist/60 px-2 py-0.5 text-xs font-medium text-smoke">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-smoke">
                      Added {new Date(a.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  className="btn-ghost text-alert hover:bg-alert/10 hover:text-alert disabled:opacity-40"
                  onClick={() => void removeAdmin(a.email)}
                  disabled={isSelf}
                  title={isSelf ? "You can't remove yourself" : "Remove admin"}
                >
                  <UserMinus size={16} /> Remove
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
