import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MonitorPlay, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { usePlanLimits } from "../../lib/usePlanLimits";
import type { Menu, Playlist, Screen } from "../../lib/types";
import { isScreenOnline, timeAgo } from "../../lib/format";

export default function ScreensPage() {
  const { restaurant } = useAuth();
  const [screens, setScreens] = useState<Screen[] | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!restaurant) return;
    const [{ data: s }, { data: m }, { data: p }] = await Promise.all([
      supabase.from("screens").select("*").eq("restaurant_id", restaurant.id).order("paired_at"),
      supabase.from("menus").select("*").eq("restaurant_id", restaurant.id).order("name"),
      supabase.from("playlists").select("*").eq("restaurant_id", restaurant.id).order("name"),
    ]);
    setScreens((s as Screen[]) ?? []);
    setMenus((m as Menu[]) ?? []);
    setPlaylists((p as Playlist[]) ?? []);
  }, [restaurant]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 20_000);
    return () => clearInterval(interval);
  }, [load]);

  async function assign(screen: Screen, value: string) {
    const patch =
      value === ""
        ? { assigned_menu_id: null, assigned_playlist_id: null }
        : value.startsWith("menu:")
          ? { assigned_menu_id: value.slice(5), assigned_playlist_id: null }
          : { assigned_menu_id: null, assigned_playlist_id: value.slice(9) };
    setScreens((s) => s!.map((x) => (x.id === screen.id ? { ...x, ...patch } : x)));
    await supabase.from("screens").update(patch).eq("id", screen.id);
  }

  async function rename(screen: Screen, name: string) {
    setScreens((s) => s!.map((x) => (x.id === screen.id ? { ...x, name } : x)));
    await supabase.from("screens").update({ name }).eq("id", screen.id);
  }

  async function removeScreen(screen: Screen) {
    if (!confirm(`Remove "${screen.name}"? The TV will stop displaying and its token is revoked.`)) return;
    setScreens((s) => s!.filter((x) => x.id !== screen.id));
    await supabase.from("screens").delete().eq("id", screen.id);
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (code.trim()) navigate(`/pair/${code.trim().toUpperCase()}`);
  }

  const playerUrl = `${window.location.origin}/play`;
  const { screens: screenLimit } = usePlanLimits();
  const atLimit = (screens?.length ?? 0) >= screenLimit;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Screens</h1>
          <p className="mt-1 text-sm text-smoke">
            Every TV, tablet or display running your menus.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd((v) => !v)} disabled={atLimit}>
          <Plus size={16} /> Add screen
        </button>
      </div>
      {atLimit && (
        <p className="mt-3 text-sm text-smoke">
          Your plan includes up to {screenLimit} screen{screenLimit === 1 ? "" : "s"}.
        </p>
      )}

      {showAdd && !atLimit && (
        <div className="card mt-6 p-6">
          <h2 className="font-semibold">Pair a new screen</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-smoke">
            <li>
              On your TV, tablet or display, open the browser and go to{" "}
              <code className="rounded bg-cloud px-1.5 py-0.5 font-medium text-ink">{playerUrl}</code>
            </li>
            <li>The screen shows a QR code — scan it with your phone (you're already logged in), or…</li>
            <li>Type the 6-letter code from the TV here:</li>
          </ol>
          <form onSubmit={submitCode} className="mt-4 flex max-w-xs gap-2">
            <input
              className="input font-mono uppercase tracking-widest"
              placeholder="ABC123"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" className="btn-primary shrink-0">
              Pair
            </button>
          </form>
          <p className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
            <strong>Best results:</strong> run the player on a ~$25 streaming
            stick in kiosk mode — true fullscreen, starts on power-on.{" "}
            <Link to="/app/setup-tv" className="font-medium text-brand">
              See the TV setup guide →
            </Link>
          </p>
        </div>
      )}

      {screens === null ? (
        <p className="mt-10 text-sm text-smoke">Loading…</p>
      ) : screens.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center p-14 text-center">
          <MonitorPlay size={36} className="text-smoke" strokeWidth={1.5} />
          <p className="mt-4 font-medium">No screens yet</p>
          <p className="mt-1 max-w-sm text-sm text-smoke">
            Add one and we'll have you live in minutes.
          </p>
          <button className="btn-primary mt-6" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add your first screen
          </button>
          <Link to="/app/setup-tv" className="mt-3 text-sm font-medium text-brand">
            Not sure what hardware to use? Read the TV setup guide
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          {screens.map((screen) => {
            const online = isScreenOnline(screen.last_seen_at);
            const assignedValue = screen.assigned_menu_id
              ? `menu:${screen.assigned_menu_id}`
              : screen.assigned_playlist_id
                ? `playlist:${screen.assigned_playlist_id}`
                : "";
            return (
              <div key={screen.id} className="card p-5">
                <div className="flex items-center gap-3">
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold outline-none focus:border-mist"
                    defaultValue={screen.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== screen.name) void rename(screen, v);
                    }}
                  />
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                      online ? "bg-live/10 text-live" : "bg-alert/10 text-alert"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-live" : "bg-alert"}`} />
                    {online ? "Online" : "Offline"}
                  </span>
                  <button
                    className="btn-ghost px-2 text-alert hover:bg-alert/10 hover:text-alert"
                    onClick={() => void removeScreen(screen)}
                    title="Remove screen"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <p className="mt-1 px-2 text-xs text-smoke">
                  {screen.orientation} · last seen {timeAgo(screen.last_seen_at)}
                </p>
                <div className="mt-4">
                  <label className="label">Displaying</label>
                  <select
                    className="input"
                    value={assignedValue}
                    onChange={(e) => void assign(screen, e.target.value)}
                  >
                    <option value="">Nothing assigned</option>
                    {menus.length > 0 && (
                      <optgroup label="Menus">
                        {menus.map((m) => (
                          <option key={m.id} value={`menu:${m.id}`}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {playlists.length > 0 && (
                      <optgroup label="Playlists">
                        {playlists.map((p) => (
                          <option key={p.id} value={`playlist:${p.id}`}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
