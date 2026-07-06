import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { EmptyState, PageHeader, StatusBadge } from "./ui";

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
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // debounce so we don't hit the DB on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      const { data } = await supabase.rpc("admin_list_tenants", {
        p_search: debounced || null,
        p_limit: 50,
        p_offset: 0,
      });
      const result = data as { total: number; rows: TenantRow[] };
      setTotal(result?.total ?? 0);
      setRows(result?.rows ?? []);
      setLoading(false);
    })();
  }, [debounced]);

  function planLabel(r: TenantRow) {
    if (r.plan_id) return r.plan_id;
    return "trial";
  }

  return (
    <div>
      <PageHeader
        title="Tenants"
        subtitle={`${total} restaurant${total === 1 ? "" : "s"} on the platform.`}
      />

      <div className="relative mt-6 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke/60" />
        <input
          className="input pl-9"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-cloud/50 text-xs uppercase tracking-wide text-smoke">
              <tr>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Screens</th>
                <th className="px-4 py-3 text-right font-medium">Menus</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-mist last:border-0">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-5 w-full animate-pulse rounded bg-mist/60" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Building2}
                      title={debounced ? "No matches" : "No tenants yet"}
                      hint={
                        debounced
                          ? "Try a different name or email."
                          : "Restaurants appear here as owners sign up."
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-mist transition-colors last:border-0 hover:bg-cloud/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/platform/tenants/${r.id}`}
                        className="font-medium text-brand hover:text-ember"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-smoke">{r.owner_email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-mist/60 px-2.5 py-1 text-xs font-medium capitalize text-smoke">
                        {planLabel(r)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.screen_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.menu_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
