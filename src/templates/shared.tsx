import { Flame, Leaf, MoonStar, Sprout, Star, WheatOff, type LucideIcon } from "lucide-react";
import type {
  MenuItem,
  MenuSection,
  Orientation,
  TemplateConfig,
} from "../lib/types";
export const TAG_ICONS: Record<string, LucideIcon> = {
  vegetarian: Leaf,
  vegan: Sprout,
  halal: MoonStar,
  spicy: Flame,
  "gluten-free": WheatOff,
};

export interface BoardData {
  restaurantName: string;
  logoUrl?: string | null;
  currency: string;
  menuName: string;
  sections: (MenuSection & { items: MenuItem[] })[];
}

export interface InnerProps {
  data: BoardData;
  cfg: TemplateConfig;
  orientation: Orientation;
  sections: (MenuSection & { items: MenuItem[] })[];
}

/** Sorted sections with only available items; empty sections dropped. */
export function prepSections(
  sections: BoardData["sections"]
): BoardData["sections"] {
  return sections
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      ...s,
      items: s.items
        .filter((i) => i.available)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
    .filter((s) => s.items.length > 0);
}

export function boardDimensions(orientation: Orientation) {
  return orientation === "portrait"
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

export function columnsFor(
  orientation: Orientation,
  sectionCount: number,
  override?: TemplateConfig["columns"]
) {
  if (override && override !== "auto") {
    return orientation === "portrait" ? Math.min(override, 2) : override;
  }
  return orientation === "portrait" ? 1 : Math.min(3, Math.max(2, sectionCount));
}

/** Small accent pill shown next to featured items. */
export function FeaturedBadge({ cfg }: { cfg: TemplateConfig }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: cfg.accent,
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: 600,
        fontFamily: FONTS.body,
        lineHeight: 1,
        padding: "6px 14px",
        borderRadius: 999,
        marginLeft: 12,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        letterSpacing: 0.3,
      }}
    >
      <Star size={14} fill="#FFFFFF" strokeWidth={0} />
      {cfg.badgeText?.trim() || "Popular"}
    </span>
  );
}

/**
 * Dietary tag icons + calories, shown under an item on the boards.
 * Renders nothing when the item has neither.
 */
export function ItemExtras({
  item,
  color,
  size = 19,
}: {
  item: MenuItem;
  color: string;
  size?: number;
}) {
  const tags = (item.tags ?? []).filter((t) => TAG_ICONS[t]);
  if (tags.length === 0 && item.calories == null) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.45,
        marginTop: 6,
        color,
        fontSize: size * 0.95,
        fontFamily: FONTS.body,
        lineHeight: 1,
      }}
    >
      {tags.map((t) => {
        const Icon = TAG_ICONS[t];
        return <Icon key={t} size={size} strokeWidth={2.2} />;
      })}
      {item.calories != null && (
        <span style={{ fontWeight: 500 }}>{item.calories} kcal</span>
      )}
    </div>
  );
}

export function ItemImage({
  item,
  size,
  radius,
}: {
  item: MenuItem;
  size: number;
  radius?: number;
}) {
  if (!item.image_url) return null;
  return (
    <img
      src={item.image_url}
      alt=""
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: radius ?? size * 0.22,
        flexShrink: 0,
      }}
    />
  );
}

/** Subtle grain overlay (chalk/texture boards). Pure SVG, no assets. */
export const NOISE_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(%23n)' opacity='0.35'/></svg>\")";

export const FONTS = {
  body: '"Poppins", sans-serif',
  grotesk: '"Space Grotesk", "Poppins", sans-serif',
  condensed: '"Bebas Neue", "Space Grotesk", sans-serif',
  serif: '"Fraunces", Georgia, serif',
  chalk: '"Caveat", cursive',
  bricolage: '"Bricolage Grotesque", "Space Grotesk", sans-serif',
  outfit: '"Outfit", "Poppins", sans-serif',
};

export const FONT_FAMILY: Record<string, string> = {
  poppins: FONTS.body,
  grotesk: FONTS.grotesk,
  bebas: FONTS.condensed,
  fraunces: FONTS.serif,
  caveat: FONTS.chalk,
  bricolage: FONTS.bricolage,
  outfit: FONTS.outfit,
};

const HEADING_FONT_MAP = FONT_FAMILY;

/** Heading font honoring the user's override; falls back to the template's own. */
export function headingFont(cfg: TemplateConfig, fallback: string) {
  if (cfg.headingFont && cfg.headingFont !== "auto") {
    return HEADING_FONT_MAP[cfg.headingFont] ?? fallback;
  }
  return fallback;
}

/**
 * Board background honoring user overrides. Returns "transparent" when a
 * background image is set (the dispatcher paints the image underneath).
 */
export function boardBg(cfg: TemplateConfig, fallback: string) {
  if (cfg.backgroundImage) return "transparent";
  return cfg.background || fallback;
}

/** Pick hero item for spotlight/promo templates. */
export function resolveHeroItem(
  sections: (MenuSection & { items: MenuItem[] })[],
  cfg: TemplateConfig
): MenuItem | null {
  if (cfg.heroItemId) {
    for (const s of sections) {
      const found = s.items.find((i) => i.id === cfg.heroItemId);
      if (found) return found;
    }
  }
  if (cfg.heroSectionId) {
    const sec = sections.find((s) => s.id === cfg.heroSectionId);
    if (sec?.items.length) {
      return sec.items.find((i) => i.featured) ?? sec.items[0];
    }
  }
  for (const s of sections) {
    const featured = s.items.find((i) => i.featured);
    if (featured) return featured;
  }
  return sections[0]?.items[0] ?? null;
}

/** Sections excluding the hero item's section (for catalog side). */
export function catalogSections(
  sections: (MenuSection & { items: MenuItem[] })[],
  heroItem: MenuItem | null
) {
  if (!heroItem) return sections;
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => i.id !== heroItem.id),
    }))
    .filter((s) => s.items.length > 0);
}
