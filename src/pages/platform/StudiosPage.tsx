import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Palette, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatBytes, timeAgo } from "../../lib/format";
import { EmptyState, PageHeader } from "./ui";

interface StudioRow {
  id: string;
  name: string;
  created_at: string;
  owner_email: string | null;
  last_sign_in_at: string | null;
  restaurant_count: number;
  paid_count: number;
  suspended_count: number;
  screen_count: number;
  menu_count: number;
  storage_bytes: number;
  operator_count: number;
  pending_invite_count: number;
}

export default function StudiosPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<StudioRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      const { data } = await supabase.rpc("admin_list_studios", {
        p_search: debounced || null,
        p_limit: 50,
        p_offset: 0,
      });
      const result = data as { total: number; rows: StudioRow[] };
      setTotal(result?.total ?? 0);
      setRows(result?.rows ?? []);
      setLoading(false);
    })();
  }, [debounced]);

  return (
    <div>
      <PageHeader
        title="Designers"
        subtitle={`${total} studio${total === 1 ? "" : "s"} bringing restaurants onto SyncMenu.`}
      />

      <div className="relative mt-6 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke/60" />
        <input
          className="input pl-9"
          placeholder="Search studio, designer email, or restaurant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-mist bg-cloud/50 text-xs uppercase tracking-wide text-smoke">
              <tr>
                <th className="px-4 py-3 font-medium">Studio</th>
                <th className="px-4 py-3 font-medium">Designer</th>
                <th className="px-4 py-3 text-right font-medium">Restaurants</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
                <th className="px-4 py-3 text-right font-medium">Screens</th>
                <th className="px-4 py-3 text-right font-medium">Menus</th>
                <th className="px-4 py-3 text-right font-medium">Storage</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-mist last:border-0">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-5 w-full animate-pulse rounded bg-mist/60" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Palette}
                      title={debounced ? "No matches" : "No studios yet"}
                      hint={
                        debounced
                          ? "Try a different studio, email, or restaurant name."
                          : "Designer accounts appear here after they create a studio."
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
                        to={`/platform/studios/${r.id}`}
                        className="font-medium text-brand hover:text-ember"
                      >
                        {r.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-smoke">
                        Joined {new Date(r.created_at).toLocaleDateString()}
                        {r.suspended_count > 0
                          ? ` · ${r.suspended_count} suspended`
                          : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-smoke">
                      {r.owner_email || "—"}
                      <span className="mt-0.5 block text-xs text-smoke/80">
                        Last login {timeAgo(r.last_sign_in_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.restaurant_count}
                      {r.pending_invite_count > 0 && (
                        <span className="mt-0.5 block text-xs text-smoke">
                          {r.pending_invite_count} invite{r.pending_invite_count === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.paid_count}
                      <span className="mt-0.5 block text-xs text-smoke">
                        {r.operator_count} operator{r.operator_count === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.screen_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.menu_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-smoke">
                      {formatBytes(Number(r.storage_bytes) || 0)}
                    </td>
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
