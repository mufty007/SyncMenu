import { useState } from "react";
import { PageHeader } from "./ui";
import ComposeTab from "./emails/ComposeTab";
import HistoryTab from "./emails/HistoryTab";
import RecipientsTab from "./emails/RecipientsTab";
import SetupTab from "./emails/SetupTab";
import type { EmailTab } from "./emails/types";

const TABS: { id: EmailTab; label: string }[] = [
  { id: "recipients", label: "Recipients" },
  { id: "compose", label: "Compose" },
  { id: "setup", label: "Setup" },
  { id: "history", label: "History" },
];

export default function EmailsPage() {
  const [tab, setTab] = useState<EmailTab>("recipients");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  function editDraft(id: string) {
    setDraftId(id);
    setTab("compose");
  }

  return (
    <div>
      <PageHeader
        title="Emails"
        subtitle="Manage recipients, SMTP delivery, announcements, and campaign history."
      />

      <div className="mt-8 border-b border-mist">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-brand text-brand"
                  : "border-transparent text-smoke hover:border-mist hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {tab === "recipients" && <RecipientsTab />}
        {tab === "compose" && (
          <ComposeTab
            draftId={draftId}
            onDraftSaved={setDraftId}
            onSent={() => {
              setDraftId(null);
              setHistoryKey((k) => k + 1);
              setTab("history");
            }}
          />
        )}
        {tab === "setup" && <SetupTab />}
        {tab === "history" && (
          <HistoryTab refreshKey={historyKey} onEditDraft={editDraft} />
        )}
      </div>
    </div>
  );
}
