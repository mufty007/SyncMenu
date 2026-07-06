import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ListVideo, Plus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import type { Playlist } from "../../lib/types";

type PlaylistWithCount = Playlist & { playlist_slides: { count: number }[] };

export default function PlaylistsPage() {
  const { restaurant } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistWithCount[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!restaurant) return;
    supabase
      .from("playlists")
      .select("*, playlist_slides(count)")
      .eq("restaurant_id", restaurant.id)
      .order("created_at")
      .then(({ data }) => setPlaylists((data as PlaylistWithCount[]) ?? []));
  }, [restaurant]);

  async function createPlaylist() {
    if (!restaurant) return;
    const { data } = await supabase
      .from("playlists")
      .insert({ restaurant_id: restaurant.id, name: "New playlist" })
      .select()
      .single();
    if (data) navigate(`/app/playlists/${data.id}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Playlists</h1>
          <p className="mt-1 text-sm text-smoke">
            Rotate multiple menu boards on a single screen.
          </p>
        </div>
        <button className="btn-primary" onClick={() => void createPlaylist()}>
          <Plus size={16} /> New playlist
        </button>
      </div>

      {playlists === null ? (
        <p className="mt-10 text-sm text-smoke">Loading…</p>
      ) : playlists.length === 0 ? (
        <div className="card mt-8 flex flex-col items-center p-14 text-center">
          <ListVideo size={36} className="text-smoke" strokeWidth={1.5} />
          <p className="mt-4 font-medium">No playlists yet</p>
          <p className="mt-1 max-w-sm text-sm text-smoke">
            Combine two or more menus into a rotating slideshow — breakfast
            board, lunch specials, drinks — all on one TV.
          </p>
          <button className="btn-primary mt-6" onClick={() => void createPlaylist()}>
            <Plus size={16} /> Create a playlist
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => (
            <Link
              key={p.id}
              to={`/app/playlists/${p.id}`}
              className="card group p-5 transition-shadow duration-200 hover:shadow-md"
            >
              <ListVideo size={22} className="text-brand" />
              <p className="mt-3 font-medium group-hover:text-brand">{p.name}</p>
              <p className="mt-0.5 text-xs text-smoke">
                {p.playlist_slides?.[0]?.count ?? 0} slide(s)
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
