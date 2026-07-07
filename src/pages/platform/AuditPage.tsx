import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { EmptyState, PageHeader } from "./ui";

interface AuditRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin_email: string;
}

// human-friendly labels for known actions; unknown ones fall back to the raw key
const ACTION_LABELS: Record<string, string> = {
  suspend_tenant: "Suspended tenant",
  unsuspend_tenant: "Unsuspended tenant",
  extend_trial: "Extended trial",
  add_admin: "Added admin",
  remove_admin: "Removed admin",
  send_campaign: "Sent announcement",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("admin_list_audit", { p_limit: 200 });
      setRows((data as AuditRow[]) ?? []);
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every platform admin action is recorded here."
      />

      <div className="card mt-8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-mist bg-cloud/50 text-xs uppercase tracking-wide text-smoke">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-mist last:border-0">
                    <td colSpan={4} className="px-4 py-3">
                      <div className="h-5 w-full animate-pulse rounded bg-mist/60" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={ScrollText}
                      title="No activity yet"
                      hint="Admin actions like suspensions and trial extensions will show up here."
                    />
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const meta = r.metadata
                    ? Object.entries(r.metadata)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")
                    : "";
                  return (
                    <tr key={r.id} className="border-b border-mist last:border-0 hover:bg-cloud/40">
                      <td className="whitespace-nowrap px-4 py-3 text-smoke">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{r.admin_email}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-mist/60 px-2.5 py-1 text-xs font-medium capitalize text-ink">
                          {actionLabel(r.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-smoke">
                        {r.target_type && (
                          <span className="capitalize">
                            {r.target_type}
                            {r.target_id ? ` ${r.target_id.slice(0, 8)}…` : ""}
                          </span>
                        )}
                        {meta && <span className="ml-1 text-xs text-smoke/70">{meta}</span>}
                        {!r.target_type && !meta && "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
