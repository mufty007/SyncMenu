import type { MenuItem } from "../lib/types";
import { formatPrice } from "../lib/format";
import {
  FONTS,
  FeaturedBadge,
  ItemExtras,
  boardBg,
  headingFont,
  resolveHeroItem,
  type InnerProps,
} from "./shared";
import { DecorativeBlob, PhotoCutout, PriceBadge } from "./primitives";

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
        background: boardBg(
          cfg,
          `linear-gradient(145deg, ${cfg.accent} 0%, ${shade(cfg.accent, -35)} 55%, #0D1117 100%)`
        ),
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
      <DecorativeBlob color="#FFFFFF" opacity={0.12} />

      {/* Hero area */}
      <div
        style={{
          flex: portrait ? "1 1 55%" : "1 1 62%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: portrait ? "48px 40px" : "48px 64px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {cfg.showLogo && data.logoUrl && (
          <img
            src={data.logoUrl}
            alt=""
            style={{ height: 56, position: "absolute", top: 32, left: portrait ? 40 : 64, objectFit: "contain" }}
          />
        )}
        {cfg.showImages && hero?.image_url && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", maxHeight: portrait ? "50%" : "65%" }}>
            <PhotoCutout src={hero.image_url} height="100%" width="auto" />
          </div>
        )}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          {hero?.featured && (
            <div style={{ marginBottom: 12 }}>
              <FeaturedBadge cfg={cfg} />
            </div>
          )}
          <div
            style={{
              fontFamily: hFont,
              fontSize: portrait ? 56 : 72,
              fontWeight: 800,
              lineHeight: 1.02,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {hero?.name ?? data.menuName}
          </div>
          {cfg.showDescriptions && hero?.description && (
            <div style={{ fontSize: 24, opacity: 0.88, marginTop: 14, maxWidth: 560, margin: "14px auto 0" }}>
              {hero.description}
            </div>
          )}
          {cfg.showPrices && hero && (
            <div style={{ marginTop: 28 }}>
              <PriceBadge
                price={formatPrice(hero.price, data.currency)}
                size="lg"
                variant="pill"
                color="#FFFFFF"
                textColor={cfg.accent}
              />
            </div>
          )}
        </div>
      </div>

      {/* Quick-list strip */}
      {quickItems.length > 0 && (
        <div
          style={{
            flex: portrait ? "0 0 auto" : "0 0 38%",
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
            padding: portrait ? "28px 36px 36px" : "40px 48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.condensed,
              fontSize: 32,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 20,
              opacity: 0.9,
            }}
          >
            {quickSection?.name ?? "Also try"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}>{item.name}</div>
        <ItemExtras item={item} color="rgba(255,255,255,0.7)" size={14} />
      </div>
      {cfg.showPrices && (
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: FONTS.grotesk, flexShrink: 0 }}>
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
