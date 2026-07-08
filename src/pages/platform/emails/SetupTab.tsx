import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Save, Send, Sparkles } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import type { EmailSettings, SetupStatus } from "./types";

function generateSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function deriveStatus(
  settings: Pick<EmailSettings, "smtp_ready" | "last_test_ok" | "smtp_api_key_set">,
  form: { apiKey: string; sender: string }
): SetupStatus {
  const hasKey = settings.smtp_api_key_set || form.apiKey.trim().length > 0;
  const hasSender = form.sender.trim().length > 0;
  if (!hasKey || !hasSender) return "not_configured";
  if (settings.last_test_ok) return "ready";
  return "partial";
}

export default function SetupTab() {
  const { session } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [apiKeySet, setApiKeySet] = useState(false);
  const [sender, setSender] = useState("");
  const [siteOrigin, setSiteOrigin] = useState("");
  const [unsubscribeSecret, setUnsubscribeSecret] = useState("");
  const [unsubscribeSet, setUnsubscribeSet] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [smtpReady, setSmtpReady] = useState(false);
  const [lastTestOk, setLastTestOk] = useState(false);
  const [lastTestAt, setLastTestAt] = useState<string | null>(null);

  function applySettings(s: EmailSettings) {
    setApiKeyMasked(s.smtp_api_key_masked);
    setApiKeySet(s.smtp_api_key_set);
    setSender(s.smtp_sender);
    setSiteOrigin(s.site_origin);
    setUnsubscribeSet(s.unsubscribe_secret_set);
    setReplyTo(s.reply_to);
    setSmtpReady(s.smtp_ready);
    setLastTestOk(s.last_test_ok);
    setLastTestAt(s.last_test_at);
    setApiKey("");
    setUnsubscribeSecret("");
  }

  useEffect(() => {
    void supabase.rpc("admin_get_email_settings").then(({ data, error: err }) => {
      if (!err && data) applySettings(data as EmailSettings);
      setLoaded(true);
    });
  }, []);

  const status = useMemo(
    () =>
      deriveStatus(
        { smtp_ready: smtpReady, last_test_ok: lastTestOk, smtp_api_key_set: apiKeySet },
        { apiKey, sender }
      ),
    [smtpReady, lastTestOk, apiKeySet, apiKey, sender]
  );

  function validate(): string | null {
    const effectiveKey = apiKey.trim() || (apiKeySet ? "saved" : "");
    if (!effectiveKey) return "SMTP2Go API key is required.";
    if (!sender.trim()) return "Sender email is required.";
    if (!siteOrigin.trim()) return "Site URL is required.";
    try {
      new URL(siteOrigin.trim());
    } catch {
      return "Site URL must be a valid URL.";
    }
    return null;
  }

  async function save() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const payload: Record<string, unknown> = {
      smtp_sender: sender.trim(),
      site_origin: siteOrigin.trim(),
      reply_to: replyTo.trim(),
    };
    if (apiKey.trim()) payload.smtp_api_key = apiKey.trim();
    if (unsubscribeSecret.trim()) payload.unsubscribe_secret = unsubscribeSecret.trim();

    const { data, error: err } = await supabase.rpc("admin_update_email_settings", {
      p_email: payload,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    applySettings(data as EmailSettings);
    setMessage("SMTP settings saved. Platform → Emails is now the source of truth for delivery.");
  }

  async function sendTest() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    const body: Record<string, unknown> = {
      to: session?.user.email,
      record_test: true,
      smtp_sender: sender.trim(),
      site_origin: siteOrigin.trim(),
      reply_to: replyTo.trim() || undefined,
    };
    if (apiKey.trim()) body.smtp_api_key = apiKey.trim();
    if (unsubscribeSecret.trim()) body.unsubscribe_secret = unsubscribeSecret.trim();

    const { data, error: err } = await supabase.functions.invoke("send-test-email", { body });
    setBusy(false);
    if (err) {
      setError(err.message);
      const { data: refreshed } = await supabase.rpc("admin_get_email_settings");
      if (refreshed) applySettings(refreshed as EmailSettings);
      return;
    }
    setLastTestOk(true);
    setLastTestAt(new Date().toISOString());
    setMessage(`Test email sent to ${(data as { sent_to: string }).sent_to}`);
    const { data: refreshed } = await supabase.rpc("admin_get_email_settings");
    if (refreshed) applySettings(refreshed as EmailSettings);
  }

  if (!loaded) {
    return <div className="h-48 animate-pulse rounded-2xl bg-mist/40" />;
  }

  const statusBanner = {
    not_configured: {
      icon: AlertCircle,
      className: "border-alert/30 bg-alert/10 text-alert",
      title: "Not configured",
      text: "Enter your SMTP2Go API key and sender email to enable delivery.",
    },
    partial: {
      icon: RefreshCw,
      className: "border-amber-400/30 bg-amber-50 text-amber-900",
      title: "Partially configured",
      text: "Settings look complete — send a test email to confirm delivery.",
    },
    ready: {
      icon: CheckCircle2,
      className: "border-live/30 bg-live/10 text-ink",
      title: "Ready",
      text: lastTestAt
        ? `Last successful test: ${new Date(lastTestAt).toLocaleString()}`
        : "SMTP verified — announcements and automations can send.",
    },
  }[status];

  const StatusIcon = statusBanner.icon;

  return (
    <div className="space-y-6">
      <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${statusBanner.className}`}>
        <StatusIcon size={20} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">{statusBanner.title}</p>
          <p className="mt-0.5 text-sm opacity-90">{statusBanner.text}</p>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold">SMTP2Go connection</h2>
        <p className="mt-1 text-sm text-smoke">
          Configure delivery here — saved settings in the database take priority over Supabase
          secrets. Keys are only visible to platform admins and edge functions.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label className="label">SMTP2Go API key *</label>
            <input
              type="password"
              className="input font-mono"
              placeholder={apiKeySet ? `Saved (${apiKeyMasked}) — enter new key to replace` : "api-…"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">Sender email *</label>
            <input
              type="email"
              className="input"
              placeholder="noreply@syncmenuapp.com"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Reply-to (optional)</label>
            <input
              type="email"
              className="input"
              placeholder="support@syncmenuapp.com"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Site URL (links in emails) *</label>
            <input
              type="url"
              className="input"
              placeholder="https://syncmenuapp.com"
              value={siteOrigin}
              onChange={(e) => setSiteOrigin(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Unsubscribe secret</label>
            <div className="flex gap-2">
              <input
                type="password"
                className="input font-mono flex-1"
                placeholder={unsubscribeSet ? "Saved — enter new to replace" : "Random string"}
                value={unsubscribeSecret}
                onChange={(e) => setUnsubscribeSecret(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className="btn-secondary shrink-0"
                onClick={() => setUnsubscribeSecret(generateSecret())}
                title="Generate random secret"
              >
                <Sparkles size={16} />
              </button>
            </div>
            <p className="mt-1 text-xs text-smoke">
              Used to sign unsubscribe links in announcement emails.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => void save()}>
            <Save size={16} /> Save SMTP settings
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => void sendTest()}>
            <Send size={16} /> Send test to {session?.user.email}
          </button>
        </div>
        <p className="mt-3 text-xs text-smoke">
          Test uses the values in this form — you do not need to save first.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-live/30 bg-live/10 p-4 text-sm">{message}</div>
      )}
      {error && <p className="text-sm text-alert">{error}</p>}
    </div>
  );
}
