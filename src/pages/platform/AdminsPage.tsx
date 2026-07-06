import { useEffect, useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface AdminRow {
  user_id: string;
  email: string;
  created_at: string;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.rpc("admin_list_admins");
    setAdmins((data as AdminRow[]) ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addAdmin() {
    setError(null);
    const { error: err } = await supabase.rpc("admin_manage_admin", {
      p_action: "add",
      p_email: email.trim(),
    });
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

  return (
    <div>
      <h1 className="text-2xl font-semibold">Platform admins</h1>
      <p className="mt-1 text-sm text-smoke">Up to 3 super admins can manage the platform.</p>

      <div className="card mt-8 p-6">
        <h2 className="font-semibold">Add admin</h2>
        <p className="mt-1 text-sm text-smoke">They must already have a SyncMenu account.</p>
        <div className="mt-4 flex gap-2">
          <input
            type="email"
            className="input max-w-sm"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary" onClick={() => void addAdmin()} disabled={!email}>
            <UserPlus size={16} /> Add
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-alert">{error}</p>}
      </div>

      <ul className="card mt-6 divide-y divide-mist">
        {admins.map((a) => (
          <li key={a.user_id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{a.email}</p>
              <p className="text-xs text-smoke">
                Added {new Date(a.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              className="btn-ghost text-alert hover:bg-alert/10"
              onClick={() => void removeAdmin(a.email)}
            >
              <UserMinus size={16} /> Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
