import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Film, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { MediaAsset, Menu, Playlist, PlaylistSlide, Transition } from "../../lib/types";

type SlideRow = PlaylistSlide & { media?: MediaAsset | null };

export default function PlaylistEditorPage() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [slides, setSlides] = useState<SlideRow[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMenuId, setAddMenuId] = useState("");
  const [addMediaId, setAddMediaId] = useState("");

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
        const rid = (p as Playlist).restaurant_id;
        const [{ data: s }, { data: m }, { data: media }] = await Promise.all([
          supabase
            .from("playlist_slides")
            .select("*, media:media_assets(*)")
            .eq("playlist_id", playlistId)
            .order("sort_order"),
          supabase.from("menus").select("*").eq("restaurant_id", rid).order("name"),
          supabase.from("media_assets").select("*").eq("restaurant_id", rid).order("name"),
        ]);
        setSlides((s as SlideRow[]) ?? []);
        setMenus((m as Menu[]) ?? []);
        setMediaAssets((media as MediaAsset[]) ?? []);
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

  const menuName = (id: string | null) => menus.find((m) => m.id === id)?.name ?? "Deleted menu";
  const mediaName = (id: string | null) => mediaAssets.find((m) => m.id === id)?.name ?? "Deleted media";

  function slideLabel(slide: SlideRow) {
    if (slide.slide_type === "media") {
      return (
        <span className="flex items-center gap-2">
          <Film size={15} className="text-brand" />
          {slide.media?.name ?? mediaName(slide.media_id)}
        </span>
      );
    }
    return menuName(slide.menu_id);
  }

  async function rename(name: string) {
    setPlaylist((p) => (p ? { ...p, name } : p));
    await supabase.from("playlists").update({ name }).eq("id", playlist!.id);
  }

  async function deletePlaylist() {
    if (!confirm(`Delete "${playlist!.name}"? Screens showing it will go blank.`)) return;
    await supabase.from("playlists").delete().eq("id", playlist!.id);
    navigate("/app/playlists");
  }

  async function addMenuSlide() {
    if (!addMenuId) return;
    const sort = slides.length ? Math.max(...slides.map((s) => s.sort_order)) + 1 : 0;
    const { data } = await supabase
      .from("playlist_slides")
      .insert({
        playlist_id: playlist!.id,
        slide_type: "menu",
        menu_id: addMenuId,
        sort_order: sort,
      })
      .select("*, media:media_assets(*)")
      .single();
    if (data) setSlides((s) => [...s, data as SlideRow]);
    setAddMenuId("");
  }

  async function addMediaSlide() {
    if (!addMediaId) return;
    const sort = slides.length ? Math.max(...slides.map((s) => s.sort_order)) + 1 : 0;
    const { data } = await supabase
      .from("playlist_slides")
      .insert({
        playlist_id: playlist!.id,
        slide_type: "media",
        media_id: addMediaId,
        sort_order: sort,
      })
      .select("*, media:media_assets(*)")
      .single();
    if (data) setSlides((s) => [...s, data as SlideRow]);
    setAddMediaId("");
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

      <div className="card mt-6 space-y-4 p-5">
        <div className="flex gap-2">
          <select
            className="input flex-1"
            value={addMenuId}
            onChange={(e) => setAddMenuId(e.target.value)}
          >
            <option value="">Add a menu slide…</option>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            className="btn-primary shrink-0"
            onClick={() => void addMenuSlide()}
            disabled={!addMenuId}
          >
            <Plus size={16} /> Menu
          </button>
        </div>
        <div className="flex gap-2">
          <select
            className="input flex-1"
            value={addMediaId}
            onChange={(e) => setAddMediaId(e.target.value)}
          >
            <option value="">Add a media promo slide…</option>
            {mediaAssets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.kind})
              </option>
            ))}
          </select>
          <button
            className="btn-secondary shrink-0"
            onClick={() => void addMediaSlide()}
            disabled={!addMediaId}
          >
            <Plus size={16} /> Media
          </button>
        </div>
        {mediaAssets.length === 0 && (
          <p className="text-sm text-smoke">
            Upload GIFs and videos in the{" "}
            <Link to="/app/media" className="font-medium text-brand">
              Media library
            </Link>
            .
          </p>
        )}
        {menus.length === 0 && (
          <p className="text-sm text-smoke">
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
            <span className="min-w-0 flex-1 truncate font-medium">{slideLabel(slide)}</span>
            {slide.slide_type === "media" && slide.media?.thumbnail_url && (
              <img
                src={slide.media.thumbnail_url}
                alt=""
                className="h-10 w-16 rounded object-cover"
              />
            )}
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
