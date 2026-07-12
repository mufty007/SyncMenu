const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.82;

/** Resize and compress images before upload so TV players load backgrounds fast. */
export async function optimizeImageForUpload(file: File): Promise<File> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Image is too large. Please choose a file under 10 MB.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  if (file.type === "image/gif") {
    if (file.size > 15 * 1024 * 1024) {
      throw new Error("GIF is too large. Please choose a file under 15 MB.");
    }
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/** Extract storage object path from a Supabase public URL, if possible. */
export function storagePathFromPublicUrl(
  publicUrl: string,
  bucket = "menu-images"
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length).split("?")[0] ?? "");
}
