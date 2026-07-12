import { useEffect, useRef, useState } from "react";
import { Film, ImagePlus, Link2, Loader2, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { trialDaysLeft } from "../../lib/format";
import type { MediaAsset } from "../../lib/types";
import {
  deleteMediaUrls,
  getStorageUsedBytes,
  storageLimitMb,
  uploadMenuMedia,
} from "../../lib/uploadMedia";
import Toggle from "../../components/Toggle";

export default function MediaLibraryPage() {
  const { restaurant } = useAuth();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedMb, setUsedMb] = useState(0);
  const [limitMb, setLimitMb] = useState(100);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!restaurant) return;
    void load();
  }, [restaurant]);

  async function load() {
    if (!restaurant) return;
    setLoading(true);
    const [{ data }, subRes] = await Promise.all([
      supabase
        .from("media_assets")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("status, plan_id")
        .eq("restaurant_id", restaurant.id)
        .maybeSingle(),
    ]);
    setAssets((data as MediaAsset[]) ?? []);
    const used = await getStorageUsedBytes(restaurant.id);
    setUsedMb(Math.round(used / 1024 / 1024));
    const subscribed =
      subRes.data?.status === "active" || subRes.data?.status === "trialing";
    const onTrial = trialDaysLeft(restaurant.trial_ends_at) > 0 && !subscribed;
    setLimitMb(storageLimitMb(subRes.data?.plan_id, onTrial));
    setLoading(false);
  }

  async function onUpload(file: File) {
    if (!restaurant || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const subRes = await supabase
        .from("subscriptions")
        .select("status, plan_id")
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();
      const subscribed =
        subRes.data?.status === "active" || subRes.data?.status === "trialing";
      const onTrial = trialDaysLeft(restaurant.trial_ends_at) > 0 && !subscribed;
      const uploaded = await uploadMenuMedia(
        restaurant.id,
        file,
        subRes.data?.plan_id,
        onTrial
      );
      const baseName = file.name.replace(/\.[^.]+$/, "") || "Untitled";
      const { data, error: err } = await supabase
        .from("media_assets")
        .insert({
          restaurant_id: restaurant.id,
          name: baseName,
          kind: uploaded.kind,
          url: uploaded.url,
          mime_type: uploaded.mime_type,
          file_size_bytes: uploaded.file_size_bytes,
          duration_seconds: uploaded.duration_seconds,
          thumbnail_url: uploaded.thumbnail_url,
        })
        .select()
        .single();
      if (err) throw new Error(err.message);
      setAssets((a) => [data as MediaAsset, ...a]);
      const used = await getStorageUsedBytes(restaurant.id);
      setUsedMb(Math.round(used / 1024 / 1024));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function patchAsset(id: string, patch: Partial<MediaAsset>) {
    setAssets((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("media_assets").update(patch).eq("id", id);
  }

  async function removeAsset(asset: MediaAsset) {
    if (!confirm(`Delete "${asset.name}"? Playlists using it will lose that slide.`)) return;
    await deleteMediaUrls(asset.url, asset.thumbnail_url);
    await supabase.from("media_assets").delete().eq("id", asset.id);
    setAssets((a) => a.filter((x) => x.id !== asset.id));
    if (restaurant) {
      const used = await getStorageUsedBytes(restaurant.id);
      setUsedMb(Math.round(used / 1024 / 1024));
    }
  }

  if (loading) return <p className="text-sm text-smoke">Loading…</p>;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Media library</h1>
          <p className="mt-1 text-sm text-smoke">
            Upload GIFs and short videos for promo slides in playlists.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          Upload media
        </button>
      </div>

      <p className="mt-3 text-xs text-smoke">
        Storage: {usedMb} / {limitMb} MB · MP4/WebM up to 30s · GIF up to 15 MB
      </p>

      {error && <p className="mt-3 text-sm text-alert">{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/gif,video/mp4,video/webm,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onUpload(f);
        }}
      />

      <div className="mt-6 space-y-4">
        {assets.map((asset) => (
          <div key={asset.id} className="card flex flex-wrap gap-4 p-4">
            <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg bg-ink">
              {asset.kind === "video" ? (
                asset.thumbnail_url ? (
                  <img src={asset.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/60">
                    <Film size={28} />
                  </div>
                )
              ) : (
                <img src={asset.url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <input
                className="input font-medium"
                value={asset.name}
                onChange={(e) => patchAsset(asset.id, { name: e.target.value })}
                onBlur={(e) => void patchAsset(asset.id, { name: e.target.value.trim() || "Untitled" })}
              />
              <div className="flex items-center gap-2">
                <Link2 size={14} className="shrink-0 text-smoke" />
                <input
                  className="input py-1.5 text-sm"
                  placeholder="Link URL (order page, promo…)"
                  value={asset.link_url ?? ""}
                  onChange={(e) => patchAsset(asset.id, { link_url: e.target.value || null })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Toggle
                  label="Show QR on screen"
                  checked={asset.show_qr}
                  onChange={(show_qr) => void patchAsset(asset.id, { show_qr })}
                />
                <span className="text-xs capitalize text-smoke">
                  {asset.kind}
                  {asset.duration_seconds != null && ` · ${Math.round(asset.duration_seconds)}s`}
                  {" · "}
                  {Math.max(1, Math.round(asset.file_size_bytes / 1024))} KB
                </span>
              </div>
            </div>
            <button
              className="btn-ghost self-start text-alert hover:bg-alert/10 hover:text-alert"
              onClick={() => void removeAsset(asset)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {assets.length === 0 && (
          <div className="card p-8 text-center text-sm text-smoke">
            No media yet. Upload a GIF or short MP4 to use in playlist promo slides.
          </div>
        )}
      </div>
    </div>
  );
}
