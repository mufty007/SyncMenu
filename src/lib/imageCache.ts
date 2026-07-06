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

/** Collect every image URL from player screen content. */
export function collectScreenImageUrls(content: {
  restaurant?: { logo_url?: string | null };
  slides?: {
    menu: {
      template_config?: { backgroundImage?: string | null; studio?: { elements?: { type?: string; url?: string }[] } };
      sections?: { items?: { image_url?: string | null }[] }[];
    };
  }[];
}): string[] {
  const urls: string[] = [];
  if (content.restaurant?.logo_url) urls.push(content.restaurant.logo_url);
  for (const slide of content.slides ?? []) {
    const cfg = slide.menu.template_config;
    if (cfg?.backgroundImage) urls.push(cfg.backgroundImage);
    for (const el of cfg?.studio?.elements ?? []) {
      if (el.type === "image" && el.url) urls.push(el.url);
    }
    for (const section of slide.menu.sections ?? []) {
      for (const item of section.items ?? []) {
        if (item.image_url) urls.push(item.image_url);
      }
    }
  }
  return urls;
}
