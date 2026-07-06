import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface AuditRow {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin_email: string;
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc("admin_list_audit", { p_limit: 200 });
      setRows((data as AuditRow[]) ?? []);
    })();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <p className="mt-1 text-sm text-smoke">Every platform admin action is recorded here.</p>

      <div className="card mt-8 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist bg-cloud/50 text-smoke">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Admin</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-mist last:border-0">
                <td className="px-4 py-3 whitespace-nowrap text-smoke">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">{r.admin_email}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.action}</td>
                <td className="px-4 py-3 text-smoke">
                  {r.target_type ?? "—"}
                  {r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
