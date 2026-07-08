import { useEffect, useState } from "react";
import { CheckCircle2, Save, Send } from "lucide-react";
import EmailEditor from "../../../components/EmailEditor";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import type { EmailSettings } from "./types";

const DEFAULT_WELCOME = `<div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1F2933">
  <h1 style="color:#FF6B2C;font-size:24px">Welcome to SyncMenu</h1>
  <p>Your digital menu board is ready to set up. Here's how to go live in minutes:</p>
  <ol>
    <li>Finish your restaurant profile</li>
    <li>Create your first menu</li>
    <li>Open <a href="{{origin}}/play">SyncMenu Play</a> on your TV and pair it</li>
  </ol>
  <p><a href="{{origin}}/app/menus" style="background:#FF6B2C;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Open your dashboard</a></p>
  <p style="color:#52606D;font-size:13px;margin-top:32px">Questions? Reply to this email — we're here to help.</p>
</div>`;

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
  const [welcomeSubject, setWelcomeSubject] = useState("");
  const [welcomeHtml, setWelcomeHtml] = useState(DEFAULT_WELCOME);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);

  function applySettings(s: EmailSettings) {
    setApiKeyMasked(s.smtp_api_key_masked);
    setApiKeySet(s.smtp_api_key_set);
    setSender(s.smtp_sender);
    setSiteOrigin(s.site_origin);
    setUnsubscribeSet(s.unsubscribe_secret_set);
    setReplyTo(s.reply_to);
    setWelcomeSubject(s.welcome_subject);
    setWelcomeHtml(s.welcome_html || DEFAULT_WELCOME);
    setWelcomeEnabled(s.welcome_enabled);
    setApiKey("");
    setUnsubscribeSecret("");
  }

  useEffect(() => {
    void supabase.rpc("admin_get_email_settings").then(({ data, error: err }) => {
      if (!err && data) applySettings(data as EmailSettings);
      setLoaded(true);
    });
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);

    const payload: Record<string, unknown> = {
      smtp_sender: sender,
      site_origin: siteOrigin,
      reply_to: replyTo,
      welcome_subject: welcomeSubject,
      welcome_html: welcomeHtml,
      welcome_enabled: welcomeEnabled,
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
    setMessage("Email settings saved. Edge functions will use these on the next send.");
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("send-test-email", {
      body: { to: session?.user.email },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMessage(`Test email sent to ${(data as { sent_to: string }).sent_to}`);
  }

  if (!loaded) {
    return <div className="h-48 animate-pulse rounded-2xl bg-mist/40" />;
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-semibold">SMTP2Go connection</h2>
        <p className="mt-1 text-sm text-smoke">
          Configure delivery here — no Supabase CLI required. Keys are stored securely in your
          database and only accessible to platform admins and edge functions.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <label className="label">SMTP2Go API key</label>
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
            <label className="label">Sender email</label>
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
            <label className="label">Site URL (links in emails)</label>
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
            <input
              type="password"
              className="input font-mono"
              placeholder={unsubscribeSet ? "Saved — enter new to replace" : "Random string"}
              value={unsubscribeSecret}
              onChange={(e) => setUnsubscribeSecret(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => void save()}>
            <Save size={16} /> Save SMTP settings
          </button>
          <button className="btn-secondary" disabled={busy || !apiKeySet} onClick={() => void sendTest()}>
            <Send size={16} /> Send test to {session?.user.email}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Welcome email</h2>
            <p className="mt-1 text-sm text-smoke">Sent automatically when someone signs up.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={welcomeEnabled}
              onChange={(e) => setWelcomeEnabled(e.target.checked)}
              className="rounded border-mist"
            />
            Enabled
          </label>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              value={welcomeSubject}
              onChange={(e) => setWelcomeSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Body</label>
            <p className="mb-2 text-xs text-smoke">
              Use <code className="rounded bg-cloud px-1">{"{{origin}}"}</code> for your site URL in
              links.
            </p>
            <EmailEditor value={welcomeHtml} onChange={setWelcomeHtml} minHeight={240} />
          </div>
        </div>

        <button className="btn-primary mt-6" disabled={busy} onClick={() => void save()}>
          <Save size={16} /> Save welcome email
        </button>
      </div>

      {apiKeySet && (
        <div className="flex items-center gap-2 rounded-xl border border-live/30 bg-live/10 px-4 py-3 text-sm">
          <CheckCircle2 size={18} className="text-live" />
          SMTP is configured — announcements and welcome emails can be sent.
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-live/30 bg-live/10 p-4 text-sm">{message}</div>
      )}
      {error && <p className="text-sm text-alert">{error}</p>}
    </div>
  );
}
