import type { MenuItem } from "../lib/types";
import { formatPrice } from "../lib/format";
import {
  FONTS,
  FeaturedBadge,
  ItemExtras,
  ItemImage,
  boardBg,
  headingFont,
  type InnerProps,
} from "./shared";
import { CategoryZone } from "./primitives";

const DEFAULT_ZONE_COLORS = ["#E5484D", "#3B82F6", "#14B8A6", "#F59E0B"];

/**
 * Vivid Zones — color-blocked category zones in a 2×2 grid (landscape)
 * or stacked columns (portrait). Each zone maps to a menu section.
 */
export default function VividBoard({ data, cfg, orientation, sections }: InnerProps) {
  const portrait = orientation === "portrait";
  const hFont = headingFont(cfg, FONTS.condensed);
  const zoneColors = cfg.zoneColors?.length ? cfg.zoneColors : DEFAULT_ZONE_COLORS;
  const displaySections = sections.slice(0, 4);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: boardBg(cfg, "#F5F7FA"),
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: FONTS.body,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: portrait ? "32px 40px 20px" : "28px 48px 20px",
          flexShrink: 0,
        }}
      >
        {cfg.showLogo && data.logoUrl && (
          <img src={data.logoUrl} alt="" style={{ height: 56, width: 56, objectFit: "contain", borderRadius: 12 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#52606D" }}>{data.restaurantName}</div>
          <div
            style={{
              fontFamily: hFont,
              fontSize: portrait ? 48 : 56,
              letterSpacing: 2,
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            {data.menuName}
          </div>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: portrait ? "1fr" : "1fr 1fr",
          gridTemplateRows: portrait ? undefined : "1fr 1fr",
          gap: 12,
          padding: portrait ? "0 24px 24px" : "0 32px 32px",
          overflow: "hidden",
        }}
      >
        {displaySections.map((section, idx) => (
          <CategoryZone
            key={section.id}
            accent={zoneColors[idx % zoneColors.length] ?? cfg.accent}
            title={section.name}
            dark={idx % 2 === 0}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {section.items.slice(0, portrait ? 5 : 6).map((item) => (
                <ZoneItem key={item.id} item={item} data={data} cfg={cfg} dark={idx % 2 === 0} />
              ))}
            </div>
          </CategoryZone>
        ))}
      </div>
    </div>
  );
}

function ZoneItem({
  item,
  data,
  cfg,
  dark,
}: {
  item: MenuItem;
  data: InnerProps["data"];
  cfg: InnerProps["cfg"];
  dark: boolean;
}) {
  const muted = dark ? "rgba(255,255,255,0.72)" : "#5B6672";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      {cfg.showImages && item.image_url && (
        <ItemImage item={item} size={48} radius={8} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>
          {item.name}
          {item.featured && <FeaturedBadge cfg={cfg} />}
        </div>
        {cfg.showDescriptions && item.description && (
          <div style={{ fontSize: 15, color: muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.description}
          </div>
        )}
        <ItemExtras item={item} color={muted} size={14} />
      </div>
      {cfg.showPrices && (
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: FONTS.grotesk, flexShrink: 0 }}>
          {formatPrice(item.price, data.currency)}
        </div>
      )}
    </div>
  );
}
