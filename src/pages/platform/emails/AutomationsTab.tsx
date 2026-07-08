import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Save, Send } from "lucide-react";
import EmailEditor from "../../../components/EmailEditor";
import {
  AUTOMATION_KEYS,
  AUTOMATION_LABELS,
  DEFAULT_AUTOMATIONS,
  SAMPLE_VARS,
  renderTemplate,
  type AutomationKey,
  type AutomationTemplate,
} from "../../../lib/emailAutomationDefaults";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";

const VARIABLES = [
  "{{origin}}",
  "{{restaurant_name}}",
  "{{owner_email}}",
  "{{trial_days_left}}",
  "{{billing_url}}",
  "{{plan_name}}",
];

export default function AutomationsTab() {
  const { session } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<AutomationKey | null>("welcome");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<AutomationKey, AutomationTemplate>>(
    DEFAULT_AUTOMATIONS
  );

  useEffect(() => {
    void supabase.rpc("admin_get_email_automations").then(({ data, error: err }) => {
      if (!err && data && typeof data === "object") {
        const merged = { ...DEFAULT_AUTOMATIONS };
        for (const key of AUTOMATION_KEYS) {
          const saved = (data as Record<string, Partial<AutomationTemplate>>)[key];
          if (saved) {
            merged[key] = {
              ...merged[key],
              ...saved,
              description: merged[key].description,
            };
          }
        }
        setTemplates(merged);
      }
      setLoaded(true);
    });
  }, []);

  function updateTemplate(key: AutomationKey, patch: Partial<AutomationTemplate>) {
    setTemplates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function save(key: AutomationKey) {
    setBusyKey(key);
    setError(null);
    setMessage(null);
    const t = templates[key];
    const payload: Record<string, unknown> = {
      enabled: t.enabled,
      subject: t.subject,
      html: t.html,
    };
    if (t.days_before != null) payload.days_before = t.days_before;

    const { error: err } = await supabase.rpc("admin_update_email_automation", {
      p_key: key,
      p_payload: payload,
    });
    setBusyKey(null);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage(`${AUTOMATION_LABELS[key]} saved.`);
  }

  async function sendTest(key: AutomationKey) {
    setBusyKey(`test-${key}`);
    setError(null);
    setMessage(null);
    const t = templates[key];
    const vars = { ...SAMPLE_VARS, owner_email: session?.user.email ?? SAMPLE_VARS.owner_email };

    const { data, error: err } = await supabase.functions.invoke("send-automation-test", {
      body: {
        subject: renderTemplate(t.subject, vars),
        html: renderTemplate(t.html, vars),
        vars,
      },
    });
    setBusyKey(null);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage(`Test "${AUTOMATION_LABELS[key]}" sent to ${(data as { sent_to: string }).sent_to}`);
  }

  if (!loaded) {
    return <div className="h-48 animate-pulse rounded-2xl bg-mist/40" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-smoke">
        Transactional emails sent automatically on signup, billing events, trial milestones, and
        account suspension. Customize templates below.
      </p>

      <div className="rounded-xl border border-mist bg-cloud/50 px-4 py-3 text-xs text-smoke">
        <span className="font-medium text-ink">Variables: </span>
        {VARIABLES.map((v, i) => (
          <span key={v}>
            <code className="rounded bg-white px-1">{v}</code>
            {i < VARIABLES.length - 1 ? ", " : ""}
          </span>
        ))}
      </div>

      {AUTOMATION_KEYS.map((key) => {
        const t = templates[key];
        const isOpen = expanded === key;
        const busy = busyKey === key || busyKey === `test-${key}`;

        return (
          <div key={key} className="card overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 p-5 text-left"
              onClick={() => setExpanded(isOpen ? null : key)}
            >
              <div>
                <h3 className="font-semibold">{AUTOMATION_LABELS[key]}</h3>
                <p className="mt-0.5 text-sm text-smoke">{t.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <label
                  className="flex items-center gap-2 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={(e) => updateTemplate(key, { enabled: e.target.checked })}
                    className="rounded border-mist"
                  />
                  Enabled
                </label>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-mist p-5 pt-4">
                {key === "trial_ending" && (
                  <div className="mb-4 max-w-xs">
                    <label className="label">Days before trial ends</label>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      className="input"
                      value={t.days_before ?? 3}
                      onChange={(e) =>
                        updateTemplate(key, { days_before: Number(e.target.value) || 3 })
                      }
                    />
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="label">Subject</label>
                    <input
                      className="input"
                      value={t.subject}
                      onChange={(e) => updateTemplate(key, { subject: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Body</label>
                    <EmailEditor value={t.html} onChange={(html) => updateTemplate(key, { html })} minHeight={220} />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={busy} onClick={() => void save(key)}>
                    <Save size={16} /> Save
                  </button>
                  <button className="btn-secondary" disabled={busy} onClick={() => void sendTest(key)}>
                    <Send size={16} /> Send test
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {message && (
        <div className="rounded-xl border border-live/30 bg-live/10 p-4 text-sm">{message}</div>
      )}
      {error && <p className="text-sm text-alert">{error}</p>}
    </div>
  );
}
