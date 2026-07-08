import { useEffect, useState } from "react";
import { Eye, Send } from "lucide-react";
import EmailEditor from "../../../components/EmailEditor";
import { supabase } from "../../../lib/supabase";
import { EMAIL_AUDIENCES } from "./types";

interface ComposeTabProps {
  draftId: string | null;
  onDraftSaved: (id: string) => void;
  onSent: () => void;
}

export default function ComposeTab({ draftId, onDraftSaved, onSent }: ComposeTabProps) {
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("<p></p>");
  const [audience, setAudience] = useState("all");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    void supabase.rpc("admin_get_campaign", { p_id: draftId }).then(({ data }) => {
      const c = data as { subject: string; body_html: string; audience: string; status: string };
      if (c?.status === "draft") {
        setSubject(c.subject);
        setBodyHtml(c.body_html || "<p></p>");
        setAudience(c.audience);
      }
    });
  }, [draftId]);

  useEffect(() => {
    void supabase.rpc("admin_get_campaign_recipients", { p_audience: audience }).then(({ data }) => {
      setRecipientCount(Array.isArray(data) ? data.length : 0);
    });
  }, [audience]);

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
    onDraftSaved(data as string);
    setMessage("Draft saved.");
  }

  async function sendCampaign() {
    if (!confirm(`Send to ~${recipientCount ?? 0} recipients?`)) return;
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
      onDraftSaved(id);
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
    setBodyHtml("<p></p>");
    onSent();
  }

  const hasBody = bodyHtml.replace(/<[^>]+>/g, "").trim().length > 0;

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Compose announcement</h2>
          <p className="mt-1 text-sm text-smoke">
            Rich HTML email — unsubscribe footer is added automatically.
          </p>
        </div>
        {recipientCount !== null && (
          <span className="rounded-full bg-cloud px-3 py-1 text-xs font-medium text-smoke">
            ~{recipientCount} recipients
          </span>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="label">Audience</label>
          <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
            {EMAIL_AUDIENCES.map((a) => (
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
          <label className="label">Body</label>
          <EmailEditor value={bodyHtml} onChange={setBodyHtml} minHeight={280} />
        </div>

        {showPreview && (
          <div className="rounded-xl border border-mist bg-white p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-smoke">Preview</p>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
        )}

        {message && (
          <p className={`text-sm ${message.includes("Sent") ? "text-live" : "text-smoke"}`}>
            {message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowPreview((v) => !v)}
            disabled={!hasBody}
          >
            <Eye size={16} /> {showPreview ? "Hide preview" : "Preview"}
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => void saveDraft()}>
            Save draft
          </button>
          <button
            className="btn-primary"
            disabled={busy || !subject || !hasBody}
            onClick={() => void sendCampaign()}
          >
            <Send size={16} /> Send now
          </button>
        </div>
      </div>
    </div>
  );
}
