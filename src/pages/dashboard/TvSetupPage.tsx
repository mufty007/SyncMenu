import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Cast,
  Copy,
  MonitorPlay,
  Tablet,
  Terminal,
} from "lucide-react";

export default function TvSetupPage() {
  const [copied, setCopied] = useState(false);
  const playerUrl = `${window.location.origin}/play`;

  function copyUrl() {
    void navigator.clipboard.writeText(playerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <Link to="/app/screens" className="btn-ghost -ml-3">
        <ArrowLeft size={15} /> Back to screens
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">TV setup guide</h1>
      <p className="mt-1 text-sm text-smoke">
        Anything with a browser can be a menu board. Here's every way to set
        one up — from "works right now" to "bulletproof kiosk".
      </p>

      {/* player URL */}
      <div className="card mt-6 flex flex-wrap items-center gap-3 p-4">
        <p className="text-sm font-medium">Your player link:</p>
        <code className="rounded-lg bg-cloud px-3 py-1.5 text-sm font-semibold">
          {playerUrl}
        </code>
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={copyUrl}>
          <Copy size={13} /> {copied ? "Copied!" : "Copy"}
        </button>
        <p className="w-full text-xs text-smoke">
          Every option below boils down to: open this link on the device, then
          scan the QR code it shows.
        </p>
      </div>

      {/* recommended */}
      <div className="card mt-6 border-brand/40 p-6 ring-1 ring-brand/30">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
            <Cast size={22} className="text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Streaming stick + kiosk app</h2>
              <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Recommended
              </span>
            </div>
            <p className="text-xs text-smoke">
              ~$25 one-off · true fullscreen · starts on power-on · survives
              power cuts
            </p>
          </div>
        </div>
        <ol className="mt-5 list-decimal space-y-2.5 pl-5 text-sm text-smoke">
          <li>
            Plug any <strong className="text-ink">Fire TV Stick</strong> or{" "}
            <strong className="text-ink">Google TV / Chromecast stick</strong>{" "}
            into the TV's HDMI port (any model works, even the cheapest).
          </li>
          <li>
            From the stick's app store, install{" "}
            <strong className="text-ink">Fully Kiosk Browser</strong> (Amazon
            Appstore on Fire TV, Play Store on Google TV). Free version is
            enough.
          </li>
          <li>
            Open Fully Kiosk → Settings → <em>Start URL</em> → paste your
            player link from above.
          </li>
          <li>
            Turn on <em>"Launch on boot"</em> and <em>"Keep screen on"</em> in
            Fully Kiosk's settings.
          </li>
          <li>
            The player loads fullscreen and shows a QR code — scan it with your
            phone to pair. Done.
          </li>
        </ol>
        <p className="mt-4 rounded-xl bg-cloud p-3 text-xs text-smoke">
          Why this is the pro setup: no browser bars ever, the menu comes back
          by itself after a power cut, and it doesn't depend on your TV's
          (often flaky) built-in browser. Set the TV to the HDMI input and
          forget it exists.
        </p>
      </div>

      {/* other options */}
      <div className="mt-5 space-y-5">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
              <MonitorPlay size={22} className="text-brand" />
            </div>
            <div>
              <h2 className="font-semibold">Smart TV browser</h2>
              <p className="text-xs text-smoke">Free · works right now · quickest start</p>
            </div>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-smoke">
            <li>Open the TV's built-in web browser and go to your player link.</li>
            <li>
              Press <strong className="text-ink">OK</strong> when the player asks — it goes
              fullscreen and hides the browser bars.
            </li>
            <li>Scan the QR code to pair.</li>
          </ol>
          <p className="mt-3 text-xs text-smoke">
            Honest caveat: some TV browsers drop out of fullscreen when idle or
            reload overnight. Fine for trying things out — for daily service,
            use the stick setup above.
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
              <Tablet size={22} className="text-brand" />
            </div>
            <div>
              <h2 className="font-semibold">Tablet or iPad</h2>
              <p className="text-xs text-smoke">Great for counters and small displays</p>
            </div>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-smoke">
            <li>Open the player link in Chrome or Safari.</li>
            <li>
              Use <em>"Add to Home Screen"</em> — SyncMenu installs as an app
              and launches fullscreen with no browser bars.
            </li>
            <li>
              Enable <em>Guided Access</em> (iPad) or <em>screen pinning</em>{" "}
              (Android) so customers can't tap out of it.
            </li>
          </ol>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
              <Terminal size={22} className="text-brand" />
            </div>
            <div>
              <h2 className="font-semibold">Raspberry Pi or spare PC</h2>
              <p className="text-xs text-smoke">For the DIY crowd</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-smoke">
            Launch Chromium in kiosk mode pointing at your player link — fully
            chromeless, auto-startable via your OS:
          </p>
          <code className="mt-3 block overflow-x-auto rounded-xl bg-ink p-3 text-xs text-white">
            chromium-browser --kiosk --noerrdialogs --disable-session-crashed-bubble {playerUrl}
          </code>
        </div>
      </div>
    </div>
  );
}
