import { useEffect, useState } from "react";
import { Mail, Pencil } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { EmptyState, StatusBadge } from "../ui";
import type { Campaign } from "./types";

interface HistoryTabProps {
  onEditDraft: (id: string) => void;
  refreshKey: number;
}

export default function HistoryTab({ onEditDraft, refreshKey }: HistoryTabProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [viewing, setViewing] = useState<Campaign | null>(null);

  useEffect(() => {
    void supabase.rpc("admin_list_campaigns").then(({ data }) => {
      setCampaigns((data as Campaign[]) ?? []);
    });
  }, [refreshKey]);

  async function openCampaign(id: string) {
    const { data } = await supabase.rpc("admin_get_campaign", { p_id: id });
    setViewing(data as Campaign);
  }

  return (
    <>
      <div className="card overflow-hidden">
        <h2 className="border-b border-mist px-4 py-3 font-semibold">Campaign history</h2>
        <div className="table-scroll">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-mist bg-cloud/50 text-smoke">
              <tr>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Audience</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Recipients</th>
                <th className="px-4 py-3 font-medium">Sent</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Mail}
                      title="No campaigns yet"
                      hint="Compose an announcement in the Compose tab."
                    />
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-mist last:border-0 hover:bg-cloud/40">
                    <td className="px-4 py-3 font-medium">{c.subject}</td>
                    <td className="px-4 py-3 capitalize">{c.audience}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.recipient_count ?? "—"}</td>
                    <td className="px-4 py-3 text-smoke">
                      {c.sent_at ? new Date(c.sent_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "draft" ? (
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => onEditDraft(c.id)}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                      ) : (
                        <button
                          className="btn-ghost text-xs"
                          onClick={() => void openCampaign(c.id)}
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{viewing.subject}</h3>
                <p className="mt-1 text-sm text-smoke capitalize">
                  {viewing.audience} · <StatusBadge status={viewing.status} />
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
            <div
              className="prose prose-sm mt-6 max-w-none rounded-xl border border-mist bg-white p-4"
              dangerouslySetInnerHTML={{ __html: viewing.body_html ?? "" }}
            />
          </div>
        </div>
      )}
    </>
  );
}
