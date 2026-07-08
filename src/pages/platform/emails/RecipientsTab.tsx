import { useEffect, useState } from "react";
import { Download, Mail, Users } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { EmptyState, StatCard } from "../ui";
import { EMAIL_AUDIENCES, type EmailRecipient, type EmailStats } from "./types";

export default function RecipientsTab() {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [audience, setAudience] = useState("all");
  const [rows, setRows] = useState<EmailRecipient[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void supabase.rpc("admin_email_stats").then(({ data }) => {
      setStats(data as EmailStats);
    });
  }, []);

  useEffect(() => {
    void supabase
      .rpc("admin_list_email_recipients", { p_audience: audience, p_limit: 200, p_offset: 0 })
      .then(({ data }) => {
        const payload = data as { total: number; rows: EmailRecipient[] };
        setTotal(payload?.total ?? 0);
        setRows(payload?.rows ?? []);
      });
  }, [audience]);

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.email.toLowerCase().includes(search.toLowerCase()) ||
      r.restaurant_name.toLowerCase().includes(search.toLowerCase())
  );

  async function exportEmails() {
    const { data } = await supabase.rpc("admin_export_emails");
    const list = (data as { email: string; restaurant_name: string }[]) ?? [];
    const csv = ["email,restaurant", ...list.map((r) => `"${r.email}","${r.restaurant_name}"`)].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "syncmenu-emails.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Restaurant owners" value={stats.total_owners} />
          <StatCard icon={Mail} label="Opted in" value={stats.opted_in} accent />
          <StatCard icon={Mail} label="Unsubscribed" value={stats.unsubscribed} />
          <StatCard icon={Mail} label="Campaigns sent" value={stats.campaigns_sent} />
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input max-w-[14rem]"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              {EMAIL_AUDIENCES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <input
              className="input max-w-xs"
              placeholder="Search email or restaurant…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-secondary" onClick={() => void exportEmails()}>
            <Download size={16} /> Export all opted-in
          </button>
        </div>
        <p className="border-b border-mist bg-cloud/40 px-4 py-2 text-xs text-smoke">
          Showing {filtered.length} of {total} in this audience
        </p>
        <div className="table-scroll">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-mist bg-cloud/50 text-smoke">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Restaurant</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Marketing</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState icon={Users} title="No recipients" hint="Try another audience filter." />
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.user_id} className="border-b border-mist last:border-0 hover:bg-cloud/40">
                    <td className="px-4 py-3">{r.email}</td>
                    <td className="px-4 py-3">{r.restaurant_name}</td>
                    <td className="px-4 py-3 capitalize text-smoke">
                      {r.plan_id ?? (r.subscription_status === "none" ? "trial" : "—")}
                    </td>
                    <td className="px-4 py-3">
                      {r.unsubscribed_at || !r.marketing_opt_in ? (
                        <span className="text-alert">Unsubscribed</span>
                      ) : (
                        <span className="text-live">Opted in</span>
                      )}
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
