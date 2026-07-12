import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import type { ScreenContent } from "../../lib/types";
import MenuBoard, { boardDimensions } from "../../templates/MenuBoard";
import MediaSlide from "../../templates/MediaSlide";
import Logo, { SyncIcon } from "../../components/Logo";
import {
  collectScreenImageUrls,
  collectScreenVideoUrls,
  preloadImages,
  preloadVideos,
  warmImageCache,
} from "../../lib/imageCache";

const DEVICE_KEY = "syncmenu.device";
const CONTENT_KEY = "syncmenu.content";
const FS_DISMISS_KEY = "syncmenu.fs-dismissed";
const POLL_MS = 30_000;

/** Keeps the display awake during service where the Wake Lock API exists. */
function useWakeLock() {
  useEffect(() => {
    type WakeLockSentinel = { release(): Promise<void> };
    const wakeLock = (
      navigator as Navigator & {
        wakeLock?: { request(type: "screen"): Promise<WakeLockSentinel> };
      }
    ).wakeLock;
    if (!wakeLock) return;
    let sentinel: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        sentinel = await wakeLock.request("screen");
      } catch {
        // denied or unsupported in this context — screens still work, they may just sleep
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}

/**
 * "Go fullscreen" nudge. Browsers only allow fullscreen after a user gesture,
 * so we ask for one tap / OK press. Hidden when already fullscreen (e.g.
 * inside a kiosk browser), unsupported, or dismissed.
 */
function FullscreenPrompt() {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(FS_DISMISS_KEY) === "1"
  );
  const supported = typeof document.documentElement.requestFullscreen === "function" &&
    document.fullscreenEnabled;

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const active = supported && !isFullscreen && !dismissed;

  useEffect(() => {
    if (!active) return;
    // TV remotes send Enter for the OK button
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        void document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 cursor-auto items-center gap-1 rounded-full bg-black/75 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-lg backdrop-blur">
      <button
        onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}
        className="font-medium"
      >
        Tap here — or press OK — for fullscreen
      </button>
      <button
        onClick={() => {
          localStorage.setItem(FS_DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface DeviceCreds {
  token: string;
  screenId: string;
}

function loadDevice(): DeviceCreds | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    return raw ? (JSON.parse(raw) as DeviceCreds) : null;
  } catch {
    return null;
  }
}

function loadCachedContent(): ScreenContent | null {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    return raw ? (JSON.parse(raw) as ScreenContent) : null;
  } catch {
    return null;
  }
}

export default function PlayerPage() {
  const [device, setDevice] = useState<DeviceCreds | null>(loadDevice);
  useWakeLock();

  useEffect(() => {
    // ?reset clears the stored pairing (handy when moving a TV)
    if (new URLSearchParams(window.location.search).has("reset")) {
      localStorage.removeItem(DEVICE_KEY);
      localStorage.removeItem(CONTENT_KEY);
      window.location.replace("/play");
    }
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <CenterScreen>
        <Logo variant="white" size={34} />
        <p className="mt-6 text-white/70">Player not configured — see README.</p>
      </CenterScreen>
    );
  }

  return (
    <>
      {device ? (
        <ContentView
          device={device}
          onRevoked={() => {
            localStorage.removeItem(DEVICE_KEY);
            localStorage.removeItem(CONTENT_KEY);
            setDevice(null);
          }}
        />
      ) : (
        <PairingView
          onPaired={(creds) => {
            localStorage.setItem(DEVICE_KEY, JSON.stringify(creds));
            setDevice(creds);
          }}
        />
      )}
      <FullscreenPrompt />
    </>
  );
}

function CenterScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-ink p-8 text-center">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pairing: charcoal background, white logo, orange QR frame           */
/* ------------------------------------------------------------------ */
function PairingView({ onPaired }: { onPaired: (creds: DeviceCreds) => void }) {
  const [session, setSession] = useState<{
    session_id: string;
    code: string;
    secret: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase.rpc("create_pairing_session");
    if (err || !data) {
      setError("Can't reach SyncMenu — retrying…");
      return;
    }
    setSession(data as { session_id: string; code: string; secret: string });
  }, []);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  // retry session creation while it keeps failing
  useEffect(() => {
    if (session || !error) return;
    const t = setTimeout(() => void startSession(), 5000);
    return () => clearTimeout(t);
  }, [session, error, startSession]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.rpc("check_pairing_session", {
        p_session: session.session_id,
        p_secret: session.secret,
      });
      const result = data as
        | { status: "pending" }
        | { status: "expired" }
        | { status: "claimed"; device_token: string; screen_id: string };
      if (!result) return;
      if (result.status === "claimed") {
        onPaired({ token: result.device_token, screenId: result.screen_id });
      } else if (result.status === "expired") {
        setSession(null);
        void startSession();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [session, onPaired, startSession]);

  const pairUrl = session ? `${window.location.origin}/pair/${session.code}` : "";

  return (
    <CenterScreen>
      <Logo variant="white" size={36} />
      {session ? (
        <>
          <p className="mt-8 max-w-md text-lg text-white/80">
            Scan with your phone to add this screen
          </p>
          <div className="mt-6 rounded-3xl border-[6px] border-brand bg-white p-5">
            <QRCodeSVG value={pairUrl} size={220} />
          </div>
          <p className="mt-6 text-white/60">
            or enter this code in your dashboard:
          </p>
          <p className="mt-2 font-mono text-5xl font-bold tracking-[0.3em] text-white">
            {session.code}
          </p>
        </>
      ) : (
        <p className="mt-8 text-white/70">{error ?? "Connecting…"}</p>
      )}
    </CenterScreen>
  );
}

/* ------------------------------------------------------------------ */
/* Content: realtime sync, offline cache, playlist rotation            */
/* ------------------------------------------------------------------ */
function ContentView({
  device,
  onRevoked,
}: {
  device: DeviceCreds;
  onRevoked: () => void;
}) {
  const [content, setContent] = useState<ScreenContent | null>(loadCachedContent);
  const [offline, setOffline] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const contentRef = useRef(content);
  contentRef.current = content;

  const fetchContent = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_screen_content", {
      p_token: device.token,
    });
    if (error || !data) {
      setOffline(true);
      return;
    }
    const next = data as ScreenContent;
    if (next.status === "revoked") {
      onRevoked();
      return;
    }
    if (next.status === "suspended" || next.status === "trial_expired") {
      setOffline(false);
      setContent(next);
      return;
    }
    setOffline(false);
    const urls = collectScreenImageUrls(next);
    const videoUrls = collectScreenVideoUrls(next);
    void warmImageCache(urls);
    await preloadImages(urls);
    void preloadVideos(videoUrls);
    const prev = contentRef.current;
    const changed = prev && JSON.stringify(prev.slides) !== JSON.stringify(next.slides);
    setContent(next);
    localStorage.setItem(CONTENT_KEY, JSON.stringify(next));
    if (changed) {
      setSlideIndex(0);
      setPulse(true);
      setTimeout(() => setPulse(false), 800);
    }
  }, [device.token, onRevoked]);

  // initial load + heartbeat/fallback polling + reconnect on network return
  useEffect(() => {
    void fetchContent();
    const interval = setInterval(() => void fetchContent(), POLL_MS);
    const onOnline = () => void fetchContent();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [fetchContent]);

  // realtime: instant refresh when the dashboard changes anything
  useEffect(() => {
    const channel = supabase
      .channel(`screen:${device.screenId}`)
      .on("broadcast", { event: "content_updated" }, () => void fetchContent())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [device.screenId, fetchContent]);

  // viewport scaling
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const slides = content?.slides ?? [];
  const slide = slides.length ? slides[slideIndex % slides.length] : null;

  // playlist rotation
  useEffect(() => {
    if (!slide || slides.length < 2 || slide.duration_seconds <= 0) return;
    const t = setTimeout(
      () => setSlideIndex((i) => (i + 1) % slides.length),
      slide.duration_seconds * 1000
    );
    return () => clearTimeout(t);
  }, [slide, slides.length, slideIndex]);

  if (!content) {
    return (
      <CenterScreen>
        <Logo variant="white" size={34} />
        <p className="mt-6 text-white/70">
          {offline ? "Waiting for connection…" : "Loading your menu…"}
        </p>
      </CenterScreen>
    );
  }

  if (content.status === "suspended") {
    return (
      <CenterScreen>
        <SyncIcon size={64} />
        <p className="mt-8 text-2xl font-semibold text-white">Account suspended</p>
        <p className="mt-2 max-w-md text-white/60">
          This screen is paused. The restaurant owner needs to contact SyncMenu support.
        </p>
      </CenterScreen>
    );
  }

  if (content.status === "trial_expired") {
    return (
      <CenterScreen>
        <SyncIcon size={64} />
        <p className="mt-8 text-2xl font-semibold text-white">Subscription required</p>
        <p className="mt-2 max-w-md text-white/60">
          The free trial has ended. Subscribe in the dashboard to bring this screen back live.
        </p>
      </CenterScreen>
    );
  }

  if (!slide) {
    return (
      <CenterScreen>
        <SyncIcon size={64} />
        <p className="mt-8 text-2xl font-semibold text-white">
          {content.screen?.name ?? "Screen"} is connected
        </p>
        <p className="mt-2 text-white/60">
          Assign a menu or playlist in your dashboard and it appears here
          instantly.
        </p>
      </CenterScreen>
    );
  }

  const orientation =
    content.screen?.orientation ??
    (slide.slide_type === "menu" ? slide.menu.orientation : "landscape");
  const { width, height } = boardDimensions(orientation);
  const scale = Math.min(viewport.w / width, viewport.h / height);
  const isMedia = slide.slide_type === "media";
  const slideKey = isMedia ? slide.media.id : slide.menu.id;

  return (
    <div className="fixed inset-0 flex cursor-none items-center justify-center overflow-hidden bg-black">
      <div
        key={slideKey}
        className={slide.transition === "slide-up" ? "anim-slide-up" : "anim-fade"}
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: "center",
          flexShrink: 0,
        }}
      >
        {isMedia ? (
          <MediaSlide media={slide.media} orientation={orientation} priority />
        ) : (
          <MenuBoard
            data={{
              restaurantName: content.restaurant?.name ?? "",
              logoUrl: content.restaurant?.logo_url,
              currency: content.restaurant?.currency ?? "USD",
              menuName: slide.menu.name,
              sections: slide.menu.sections,
            }}
            templateId={slide.menu.template_id}
            config={slide.menu.template_config}
            orientation={orientation}
            priority
          />
        )}
      </div>
      {pulse && (
        <div className="sync-pulse pointer-events-none absolute bottom-6 right-6 h-3 w-3 rounded-full bg-brand" />
      )}
      {offline && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white/80">
          <span className="h-2 w-2 rounded-full bg-alert" />
          Offline — showing saved menu
        </div>
      )}
    </div>
  );
}
