import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Menu, Playlist, PlaylistSlide, Transition } from "../../lib/types";

export default function PlaylistEditorPage() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [slides, setSlides] = useState<PlaylistSlide[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMenuId, setAddMenuId] = useState("");

  useEffect(() => {
    if (!playlistId) return;
    (async () => {
      const { data: p } = await supabase
        .from("playlists")
        .select("*")
        .eq("id", playlistId)
        .maybeSingle();
      setPlaylist((p as Playlist) ?? null);
      if (p) {
        const [{ data: s }, { data: m }] = await Promise.all([
          supabase
            .from("playlist_slides")
            .select("*")
            .eq("playlist_id", playlistId)
            .order("sort_order"),
          supabase
            .from("menus")
            .select("*")
            .eq("restaurant_id", (p as Playlist).restaurant_id)
            .order("name"),
        ]);
        setSlides((s as PlaylistSlide[]) ?? []);
        setMenus((m as Menu[]) ?? []);
      }
      setLoading(false);
    })();
  }, [playlistId]);

  if (loading) return <p className="text-sm text-smoke">Loading…</p>;
  if (!playlist) {
    return (
      <div>
        <p className="text-sm text-smoke">Playlist not found.</p>
        <Link to="/app/playlists" className="btn-secondary mt-4">
          <ArrowLeft size={16} /> Back to playlists
        </Link>
      </div>
    );
  }

  const menuName = (id: string) => menus.find((m) => m.id === id)?.name ?? "Deleted menu";

  async function rename(name: string) {
    setPlaylist((p) => (p ? { ...p, name } : p));
    await supabase.from("playlists").update({ name }).eq("id", playlist!.id);
  }

  async function deletePlaylist() {
    if (!confirm(`Delete "${playlist!.name}"? Screens showing it will go blank.`)) return;
    await supabase.from("playlists").delete().eq("id", playlist!.id);
    navigate("/app/playlists");
  }

  async function addSlide() {
    if (!addMenuId) return;
    const sort = slides.length ? Math.max(...slides.map((s) => s.sort_order)) + 1 : 0;
    const { data } = await supabase
      .from("playlist_slides")
      .insert({ playlist_id: playlist!.id, menu_id: addMenuId, sort_order: sort })
      .select()
      .single();
    if (data) setSlides((s) => [...s, data as PlaylistSlide]);
    setAddMenuId("");
  }

  async function patchSlide(id: string, patch: Partial<PlaylistSlide>) {
    setSlides((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("playlist_slides").update(patch).eq("id", id);
  }

  async function removeSlide(id: string) {
    setSlides((s) => s.filter((x) => x.id !== id));
    await supabase.from("playlist_slides").delete().eq("id", id);
  }

  async function moveSlide(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const next = slides.slice();
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = next.map((s, i) => ({ ...s, sort_order: i }));
    setSlides(reordered);
    await Promise.all(
      reordered.map((s) =>
        supabase.from("playlist_slides").update({ sort_order: s.sort_order }).eq("id", s.id)
      )
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/app/playlists" className="btn-ghost">
          <ArrowLeft size={16} />
        </Link>
        <input
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold outline-none focus:border-mist focus:bg-white"
          value={playlist.name}
          onChange={(e) => setPlaylist({ ...playlist, name: e.target.value })}
          onBlur={(e) => void rename(e.target.value.trim() || "Untitled playlist")}
        />
        <button
          className="btn-ghost text-alert hover:bg-alert/10 hover:text-alert"
          onClick={() => void deletePlaylist()}
        >
          <Trash2 size={16} /> Delete
        </button>
      </div>

      <div className="card mt-6 p-5">
        <div className="flex gap-2">
          <select
            className="input flex-1"
            value={addMenuId}
            onChange={(e) => setAddMenuId(e.target.value)}
          >
            <option value="">Choose a menu to add as a slide…</option>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button className="btn-primary shrink-0" onClick={() => void addSlide()} disabled={!addMenuId}>
            <Plus size={16} /> Add slide
          </button>
        </div>
        {menus.length === 0 && (
          <p className="mt-3 text-sm text-smoke">
            You need at least one menu first —{" "}
            <Link to="/app/menus" className="font-medium text-brand">
              create one here
            </Link>
            .
          </p>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {slides.map((slide, i) => (
          <div key={slide.id} className="card flex flex-wrap items-center gap-3 p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">
              {menuName(slide.menu_id)}
            </span>
            <label className="flex items-center gap-2 text-sm text-smoke">
              Shows for
              <input
                type="number"
                min={3}
                max={600}
                className="input w-20 py-1.5"
                value={slide.duration_seconds}
                onChange={(e) =>
                  void patchSlide(slide.id, {
                    duration_seconds: Math.min(600, Math.max(3, Number(e.target.value) || 15)),
                  })
                }
              />
              sec
            </label>
            <select
              className="input w-32 py-1.5"
              value={slide.transition}
              onChange={(e) => void patchSlide(slide.id, { transition: e.target.value as Transition })}
            >
              <option value="fade">Fade</option>
              <option value="slide-up">Slide up</option>
            </select>
            <div className="flex">
              <button className="btn-ghost px-1.5" onClick={() => void moveSlide(i, -1)} disabled={i === 0}>
                <ArrowUp size={15} />
              </button>
              <button
                className="btn-ghost px-1.5"
                onClick={() => void moveSlide(i, 1)}
                disabled={i === slides.length - 1}
              >
                <ArrowDown size={15} />
              </button>
              <button
                className="btn-ghost px-1.5 text-alert hover:bg-alert/10 hover:text-alert"
                onClick={() => void removeSlide(slide.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {slides.length === 1 && (
          <p className="text-sm text-smoke">
            Add a second slide to start rotating — one slide displays continuously.
          </p>
        )}
      </div>
    </div>
  );
}
