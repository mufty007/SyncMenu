import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

interface TenantRow {
  id: string;
  name: string;
  status: string;
  trial_ends_at: string;
  created_at: string;
  owner_email: string;
  plan_id: string | null;
  subscription_status: string | null;
  screen_count: number;
  menu_count: number;
}

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      const { data } = await supabase.rpc("admin_list_tenants", {
        p_search: search || null,
        p_limit: 50,
        p_offset: 0,
      });
      const result = data as { total: number; rows: TenantRow[] };
      setTotal(result?.total ?? 0);
      setRows(result?.rows ?? []);
      setLoading(false);
    })();
  }, [search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Tenants</h1>
      <p className="mt-1 text-sm text-smoke">{total} restaurants on the platform.</p>
      <input
        className="input mt-6 max-w-md"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist bg-cloud/50 text-smoke">
            <tr>
              <th className="px-4 py-3 font-medium">Restaurant</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Screens</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-smoke">
                  Loading…
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-mist last:border-0">
                  <td className="px-4 py-3">
                    <Link to={`/platform/tenants/${r.id}`} className="font-medium text-brand hover:text-ember">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-smoke">{r.owner_email}</td>
                  <td className="px-4 py-3 capitalize">{r.plan_id ?? "trial"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === "suspended"
                          ? "bg-alert/10 text-alert"
                          : "bg-mint/30 text-ink"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.screen_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
