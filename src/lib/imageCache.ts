import type { ScreenContent } from "./types";

const CACHE_NAME = "syncmenu-images-v1";

/** Warm the Cache API with menu image URLs for faster kiosk repeat loads. */
export async function warmImageCache(urls: string[]): Promise<void> {
  if (!("caches" in window)) return;
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return;

  try {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(
      unique.map(async (url) => {
        const hit = await cache.match(url);
        if (hit) return;
        try {
          const res = await fetch(url, { mode: "cors", credentials: "omit" });
          if (res.ok) await cache.put(url, res);
        } catch {
          // offline or CORS — browser HTTP cache may still help
        }
      })
    );
  } catch {
    // private browsing / quota
  }
}

/** Preload images into memory so the first paint is not waiting on decode. */
export function preloadImages(urls: string[]): Promise<void[]> {
  const unique = [...new Set(urls.filter(Boolean))];
  return Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  );
}

type LooseSlide = {
  slide_type?: string;
  menu?: {
    template_config?: {
      backgroundImage?: string | null;
      backgroundVideo?: string | null;
      studio?: { elements?: { type?: string; url?: string }[] };
    };
    sections?: { items?: { image_url?: string | null }[] }[];
  };
  media?: {
    kind?: string;
    url?: string;
    thumbnail_url?: string | null;
  };
};

/** Collect every image/GIF URL from player screen content. */
export function collectScreenImageUrls(content: ScreenContent | { restaurant?: { logo_url?: string | null }; slides?: LooseSlide[] }): string[] {
  const urls: string[] = [];
  if (content.restaurant?.logo_url) urls.push(content.restaurant.logo_url);
  for (const slide of content.slides ?? []) {
    if (slide.slide_type === "media" && slide.media) {
      if (slide.media.kind !== "video" && slide.media.url) urls.push(slide.media.url);
      if (slide.media.thumbnail_url) urls.push(slide.media.thumbnail_url);
      continue;
    }
    const menuSlide = "menu" in slide ? slide.menu : undefined;
    const cfg = menuSlide?.template_config;
    if (cfg?.backgroundImage) urls.push(cfg.backgroundImage);
    if (cfg?.backgroundVideo) {
      // poster only for video backgrounds — full video streams on demand
    }
    for (const el of cfg?.studio?.elements ?? []) {
      if ((el.type === "image" || el.type === "gif") && el.url) urls.push(el.url);
    }
    for (const section of menuSlide?.sections ?? []) {
      for (const item of section.items ?? []) {
        if (item.image_url) urls.push(item.image_url);
      }
    }
  }
  return urls;
}

/** Collect video URLs for opportunistic preloading. */
export function collectScreenVideoUrls(content: ScreenContent | { slides?: LooseSlide[] }): string[] {
  const urls: string[] = [];
  for (const slide of content.slides ?? []) {
    if (slide.slide_type === "media" && slide.media?.kind === "video" && slide.media.url) {
      urls.push(slide.media.url);
      continue;
    }
    const menuSlide = "menu" in slide ? slide.menu : undefined;
    const bgVideo = menuSlide?.template_config?.backgroundVideo;
    if (bgVideo) urls.push(bgVideo);
    for (const el of menuSlide?.template_config?.studio?.elements ?? []) {
      if (el.type === "video" && el.url) urls.push(el.url);
    }
  }
  return urls;
}

/** Preload video metadata (not full buffer). */
export function preloadVideos(urls: string[]): Promise<void[]> {
  const unique = [...new Set(urls.filter(Boolean))];
  return Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () => resolve();
          video.onerror = () => resolve();
          video.src = url;
        })
    )
  );
}
