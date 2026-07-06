import { useEffect, useState } from "react";
import { Download, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Campaign {
  id: string;
  subject: string;
  audience: string;
  status: string;
  sent_at: string | null;
  recipient_count: number | null;
  created_at: string;
}

const AUDIENCES = [
  { id: "all", label: "All opted-in owners" },
  { id: "active", label: "Active (trial or subscribed)" },
  { id: "trial", label: "On trial only" },
  { id: "subscribed", label: "Paying subscribers" },
  { id: "churned", label: "Churned (trial ended, no sub)" },
];

export default function EmailsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [audience, setAudience] = useState("all");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadCampaigns() {
    const { data } = await supabase.rpc("admin_list_campaigns");
    setCampaigns((data as Campaign[]) ?? []);
  }

  useEffect(() => {
    void loadCampaigns();
  }, []);

  async function saveDraft() {
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("admin_save_campaign", {
      p_id: draftId,
      p_subject: subject,
      p_body_html: bodyHtml,
      p_audience: audience,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setDraftId(data as string);
    setMessage("Draft saved.");
    void loadCampaigns();
  }

  async function sendCampaign() {
    if (!confirm("Send this announcement to the selected audience?")) return;
    setBusy(true);
    setMessage(null);

    let id = draftId;
    if (!id) {
      const { data, error } = await supabase.rpc("admin_save_campaign", {
        p_id: null,
        p_subject: subject,
        p_body_html: bodyHtml,
        p_audience: audience,
      });
      if (error) {
        setBusy(false);
        setMessage(error.message);
        return;
      }
      id = data as string;
      setDraftId(id);
    }

    const { data, error } = await supabase.functions.invoke("send-announcement", {
      body: { campaignId: id, origin: window.location.origin },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Sent to ${(data as { sent: number }).sent} recipients.`);
    setSubject("");
    setBodyHtml("");
    setDraftId(null);
    void loadCampaigns();
  }

  async function exportEmails() {
    const { data } = await supabase.rpc("admin_export_emails");
    const rows = (data as { email: string; restaurant_name: string }[]) ?? [];
    const csv = ["email,restaurant", ...rows.map((r) => `"${r.email}","${r.restaurant_name}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "syncmenu-emails.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Emails</h1>
          <p className="mt-1 text-sm text-smoke">Welcome emails are automatic. Compose platform announcements here.</p>
        </div>
        <button className="btn-secondary" onClick={() => void exportEmails()}>
          <Download size={16} /> Export email list
        </button>
      </div>

      <div className="card mt-8 p-6">
        <h2 className="font-semibold">Compose announcement</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label">Audience</label>
            <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
              {AUDIENCES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="label">Body (HTML)</label>
            <textarea
              className="input min-h-[160px] font-mono text-sm"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="<p>We've shipped a new feature…</p>"
            />
          </div>
          {message && <p className="text-sm text-smoke">{message}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary" disabled={busy} onClick={() => void saveDraft()}>
              Save draft
            </button>
            <button
              className="btn-primary"
              disabled={busy || !subject || !bodyHtml}
              onClick={() => void sendCampaign()}
            >
              <Send size={16} /> Send now
            </button>
          </div>
        </div>
      </div>

      <div className="card mt-8 overflow-hidden">
        <h2 className="border-b border-mist px-4 py-3 font-semibold">Campaign history</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-mist bg-cloud/50 text-smoke">
            <tr>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Audience</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Recipients</th>
              <th className="px-4 py-3 font-medium">Sent</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-mist last:border-0">
                <td className="px-4 py-3">{c.subject}</td>
                <td className="px-4 py-3 capitalize">{c.audience}</td>
                <td className="px-4 py-3 capitalize">{c.status}</td>
                <td className="px-4 py-3 tabular-nums">{c.recipient_count ?? "—"}</td>
                <td className="px-4 py-3 text-smoke">
                  {c.sent_at ? new Date(c.sent_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
