import { supabase } from "./supabase";
import { optimizeImageForUpload, storagePathFromPublicUrl } from "./imageOptimize";
import { PLAN_LIMITS, PLAN_LIMITS_BY_PLAN } from "./types";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;

export type UploadMediaKind = "image" | "gif" | "video";

function extFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type === "image/gif") return "gif";
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/webm") return "webm";
  return "bin";
}

/** Read video duration and reject files that are too large or too long. */
export async function validateVideoFile(file: File): Promise<number> {
  if (!file.type.startsWith("video/")) {
    throw new Error("Please choose an MP4 or WebM video.");
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error("Video is too large. Please choose a file under 50 MB.");
  }
  const duration = await new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Could not read video metadata."));
    };
    video.src = URL.createObjectURL(file);
  });
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not determine video duration.");
  }
  if (duration > MAX_VIDEO_SECONDS) {
    throw new Error(`Video must be ${MAX_VIDEO_SECONDS} seconds or shorter.`);
  }
  return duration;
}

/** Capture a poster frame from the first second of a video. */
export async function generateVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, video.duration / 2);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(1920, video.videoWidth || 1280);
      canvas.height = Math.min(1080, video.videoHeight || 720);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

export async function getStorageUsedBytes(restaurantId: string): Promise<number> {
  const { data } = await supabase
    .from("media_assets")
    .select("file_size_bytes")
    .eq("restaurant_id", restaurantId);
  return (data ?? []).reduce((sum, row) => sum + Number(row.file_size_bytes ?? 0), 0);
}

export function storageLimitMb(planId: string | null | undefined, onTrial: boolean): number {
  if (onTrial) return PLAN_LIMITS_BY_PLAN.trial.storageMb;
  return PLAN_LIMITS_BY_PLAN[planId ?? ""]?.storageMb ?? PLAN_LIMITS.storageMb;
}

export async function assertStorageQuota(
  restaurantId: string,
  additionalBytes: number,
  planId: string | null | undefined,
  onTrial: boolean
): Promise<void> {
  const used = await getStorageUsedBytes(restaurantId);
  const limit = storageLimitMb(planId, onTrial) * 1024 * 1024;
  if (used + additionalBytes > limit) {
    throw new Error("Storage limit reached. Delete old media or upgrade your plan.");
  }
}

async function uploadBlob(path: string, blob: Blob, contentType: string): Promise<string> {
  const { error } = await supabase.storage.from("menu-images").upload(path, blob, {
    contentType,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
}

export interface UploadMediaResult {
  kind: UploadMediaKind;
  url: string;
  mime_type: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  thumbnail_url: string | null;
}

/** Upload image, GIF, or video to storage. Returns metadata for media_assets row. */
export async function uploadMenuMedia(
  restaurantId: string,
  file: File,
  planId?: string | null,
  onTrial = false
): Promise<UploadMediaResult> {
  const ts = Date.now();
  const ext = extFor(file);

  if (file.type.startsWith("video/")) {
    await assertStorageQuota(restaurantId, file.size, planId, onTrial);
    const duration = await validateVideoFile(file);
    const path = `${restaurantId}/media/${ts}.${ext}`;
    const url = await uploadBlob(path, file, file.type);
    let thumbnail_url: string | null = null;
    const thumb = await generateVideoThumbnail(file);
    if (thumb) {
      thumbnail_url = await uploadBlob(`${restaurantId}/media/${ts}-thumb.jpg`, thumb, "image/jpeg");
    }
    return {
      kind: "video",
      url,
      mime_type: file.type,
      file_size_bytes: file.size,
      duration_seconds: duration,
      thumbnail_url,
    };
  }

  if (file.type === "image/gif") {
    await assertStorageQuota(restaurantId, file.size, planId, onTrial);
    const path = `${restaurantId}/media/${ts}.gif`;
    const url = await uploadBlob(path, file, "image/gif");
    return {
      kind: "gif",
      url,
      mime_type: "image/gif",
      file_size_bytes: file.size,
      duration_seconds: null,
      thumbnail_url: null,
    };
  }

  const optimized = await optimizeImageForUpload(file);
  await assertStorageQuota(restaurantId, optimized.size, planId, onTrial);
  const path = `${restaurantId}/media/${ts}.jpg`;
  const url = await uploadMenuImage(path, optimized);
  return {
    kind: "image",
    url,
    mime_type: optimized.type,
    file_size_bytes: optimized.size,
    duration_seconds: null,
    thumbnail_url: null,
  };
}

async function uploadMenuImage(path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from("menu-images").upload(path, file, {
    contentType: file.type,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
}

/** Delete media asset storage files (best effort). */
export async function deleteMediaUrls(
  url: string | null | undefined,
  thumbnailUrl?: string | null
): Promise<void> {
  for (const u of [url, thumbnailUrl]) {
    const path = u ? storagePathFromPublicUrl(u) : null;
    if (path) await supabase.storage.from("menu-images").remove([path]);
  }
}
