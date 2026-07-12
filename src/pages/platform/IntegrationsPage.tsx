import { useState } from "react";
import { PageHeader } from "./ui";
import CloverSetupTab from "./integrations/CloverSetupTab";

const TABS = [{ id: "clover" as const, label: "Clover" }];

export default function IntegrationsPage() {
  const [tab, setTab] = useState<"clover">("clover");

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Configure third-party connections — Clover credentials are platform-wide; restaurants connect their own accounts."
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

      <div className="mt-6">{tab === "clover" && <CloverSetupTab />}</div>
    </div>
  );
}
