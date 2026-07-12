import type { MenuItem } from "../lib/types";
import { formatPrice } from "../lib/format";
import {
  FONTS,
  FeaturedBadge,
  ItemExtras,
  ItemImage,
  headingFont,
  resolveHeroItem,
  type InnerProps,
} from "./shared";
import { DecorativeBlob } from "./primitives";

/**
 * Promo Hero — full-screen promotional layout with giant product photo,
 * display headline, price callout, and quick-list strip from a section.
 */
export default function PromoBoard({ data, cfg, orientation, sections }: InnerProps) {
  const portrait = orientation === "portrait";
  const hero = resolveHeroItem(sections, cfg);
  const hFont = headingFont(cfg, FONTS.bricolage);
  const quickSection = cfg.heroSectionId
    ? sections.find((s) => s.id === cfg.heroSectionId)
    : sections[0];
  const quickItems = quickSection?.items.filter((i) => i.id !== hero?.id).slice(0, 6) ?? [];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: cfg.backgroundVideo ? "#0D1117" : undefined,
        color: "#FFFFFF",
        display: "flex",
        flexDirection: portrait ? "column" : "row",
        overflow: "hidden",
        position: "relative",
        fontFamily: FONTS.body,
      }}
    >
      {cfg.backgroundVideo && (
        <video
          autoPlay
          loop
          muted
          playsInline
          src={cfg.backgroundVideo}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.35 }}
        />
      )}

      {/* Hero area — full-bleed image or gradient */}
      <div
        style={{
          flex: portrait ? "1 1 55%" : "1 1 62%",
          position: "relative",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {cfg.showImages && hero?.image_url ? (
          <img
            src={hero.image_url}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(145deg, ${cfg.accent} 0%, ${shade(cfg.accent, -35)} 55%, #0D1117 100%)`,
            }}
          />
        )}
        <DecorativeBlob color="#FFFFFF" opacity={0.12} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 32%, rgba(0,0,0,0.12) 58%, transparent 78%)",
            pointerEvents: "none",
          }}
        />
        {cfg.showLogo && data.logoUrl && (
          <img
            src={data.logoUrl}
            alt=""
            style={{
              height: 56,
              position: "absolute",
              top: 32,
              left: portrait ? 40 : 48,
              objectFit: "contain",
              zIndex: 2,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: portrait ? "40px" : "48px 56px",
            zIndex: 1,
          }}
        >
          {hero?.featured && (
            <div style={{ marginBottom: 12 }}>
              <FeaturedBadge cfg={cfg} />
            </div>
          )}
          <div
            style={{
              fontFamily: hFont,
              fontSize: portrait ? 52 : 64,
              fontWeight: 800,
              lineHeight: 1.02,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {hero?.name ?? data.menuName}
          </div>
          {cfg.showDescriptions && hero?.description && (
            <div style={{ fontSize: 22, opacity: 0.9, marginTop: 12, maxWidth: 560, lineHeight: 1.4 }}>
              {hero.description}
            </div>
          )}
          {cfg.showPrices && hero && (
            <div
              style={{
                marginTop: 18,
                fontFamily: FONTS.grotesk,
                fontSize: 44,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {formatPrice(hero.price, data.currency)}
            </div>
          )}
        </div>
      </div>

      {/* Quick-list strip */}
      {quickItems.length > 0 && (
        <div
          style={{
            flex: portrait ? "0 0 auto" : "0 0 38%",
            background: "#FFFFFF",
            color: "#1F2933",
            padding: portrait ? "28px 36px 36px" : "40px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontFamily: FONTS.condensed,
              fontSize: 28,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 20,
              color: cfg.accent,
            }}
          >
            {quickSection?.name ?? "Also try"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {quickItems.map((item) => (
              <QuickRow key={item.id} item={item} data={data} cfg={cfg} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickRow({
  item,
  data,
  cfg,
}: {
  item: MenuItem;
  data: InnerProps["data"];
  cfg: InnerProps["cfg"];
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 12px",
        borderRadius: 12,
        background: "#F7F9FB",
      }}
    >
      {cfg.showImages && item.image_url && <ItemImage item={item} size={56} radius={10} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 600, color: "#1F2933" }}>{item.name}</div>
        <ItemExtras item={item} color="#5B6672" size={14} />
      </div>
      {cfg.showPrices && (
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            fontFamily: FONTS.grotesk,
            flexShrink: 0,
            color: "#1F2933",
          }}
        >
          {formatPrice(item.price, data.currency)}
        </div>
      )}
    </div>
  );
}

function shade(hex: string, percent: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const num = parseInt(n, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round(2.55 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(2.55 * percent)));
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(2.55 * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
