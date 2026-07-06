import { supabase } from "./supabase";
import { optimizeImageForUpload, storagePathFromPublicUrl } from "./imageOptimize";

/** Optimize, upload to menu-images, return public URL. */
export async function uploadMenuImage(
  path: string,
  file: File
): Promise<string> {
  const optimized = await optimizeImageForUpload(file);
  const { error } = await supabase.storage.from("menu-images").upload(path, optimized, {
    upsert: true,
    contentType: optimized.type,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
}

/** Best-effort delete of a previous public storage URL. */
export async function deleteMenuImageUrl(publicUrl: string | null | undefined): Promise<void> {
  const path = publicUrl ? storagePathFromPublicUrl(publicUrl) : null;
  if (!path) return;
  await supabase.storage.from("menu-images").remove([path]);
}
