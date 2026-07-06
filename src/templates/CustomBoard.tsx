import { DEFAULT_CUSTOM_DESIGN, type CustomDesign, type MenuItem } from "../lib/types";
import { formatPrice } from "../lib/format";
import {
  FONTS,
  FeaturedBadge,
  ItemExtras,
  ItemImage,
  boardBg,
  columnsFor,
  headingFont,
  type InnerProps,
} from "./shared";

export function resolveCustomDesign(custom?: Partial<CustomDesign>): CustomDesign {
  return {
    ...DEFAULT_CUSTOM_DESIGN,
    ...custom,
    colors: { ...DEFAULT_CUSTOM_DESIGN.colors, ...custom?.colors },
  };
}

/**
 * Your Design — the studio template. Every layout choice, font and color
 * comes from the user's design settings; content always reflows safely.
 */
export default function CustomBoard({ data, cfg, orientation, sections }: InnerProps) {
  const d = resolveCustomDesign(cfg.custom);
  const bodyFont = d.bodyFont === "grotesk" ? FONTS.grotesk : FONTS.body;
  const hFont = headingFont(cfg, FONTS.grotesk);
  const columns = columnsFor(orientation, sections.length, cfg.columns);
  const bg = boardBg(cfg, d.colors.bg);
  const centered = d.headerAlign === "center";
  const band = d.headerStyle === "band";
  const portrait = orientation === "portrait";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: bg,
        color: d.colors.text,
        display: "flex",
        flexDirection: "column",
        fontFamily: bodyFont,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: centered ? "center" : "flex-start",
          textAlign: centered ? "center" : "left",
          gap: 6,
          ...(band
            ? {
                background: cfg.accent,
                color: "#FFFFFF",
                padding: portrait ? "44px 56px" : "36px 64px",
                marginBottom: 44,
              }
            : {
                padding: portrait ? "64px 64px 0" : "56px 72px 0",
                marginBottom: 44,
              }),
        }}
      >
        {cfg.showLogo && data.logoUrl && (
          <img
            src={data.logoUrl}
            alt=""
            style={{
              height: 78,
              width: 78,
              objectFit: "contain",
              borderRadius: 16,
              marginBottom: 8,
            }}
          />
        )}
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: 5,
            textTransform: "uppercase",
            color: band ? "rgba(255,255,255,0.85)" : d.colors.muted,
          }}
        >
          {data.restaurantName}
        </div>
        <div
          style={{
            fontFamily: hFont,
            fontSize: portrait ? 74 : 86,
            fontWeight: 700,
            lineHeight: 1.05,
            color: band ? "#FFFFFF" : d.colors.heading,
          }}
        >
          {data.menuName}
        </div>
        {d.headerStyle === "underline" && (
          <div
            style={{
              width: 110,
              height: 6,
              background: cfg.accent,
              borderRadius: 999,
              marginTop: 16,
            }}
          />
        )}
      </header>

      <div
        style={{
          flex: 1,
          padding: portrait ? "0 64px 64px" : "0 72px 56px",
          columnCount: columns,
          columnGap: 72,
          overflow: "hidden",
        }}
      >
        {sections.map((section) => (
          <section
            key={section.id}
            style={{
              breakInside: "avoid",
              marginBottom: d.sectionStyle === "cards" ? 36 : 48,
              ...(d.sectionStyle === "cards"
                ? { background: d.colors.card, borderRadius: 24, padding: "32px 34px" }
                : {}),
            }}
          >
            <h2
              style={{
                fontFamily: hFont,
                fontSize: 42,
                fontWeight: 700,
                lineHeight: 1.05,
                color: cfg.accent,
                marginBottom: 24,
              }}
            >
              {section.name}
            </h2>
            {section.items.map((item) => (
              <Row key={item.id} item={item} d={d} shared={{ data, cfg }} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function Row({
  item,
  d,
  shared,
}: {
  item: MenuItem;
  d: CustomDesign;
  shared: { data: InnerProps["data"]; cfg: InnerProps["cfg"] };
}) {
  const { data, cfg } = shared;
  const price = cfg.showPrices ? formatPrice(item.price, data.currency) : null;

  return (
    <div style={{ marginBottom: 22, display: "flex", gap: 18, alignItems: "flex-start" }}>
      {cfg.showImages && <ItemImage item={item} size={68} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: d.itemStyle === "pills" ? "center" : "baseline",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 29, fontWeight: 500 }}>
            {item.name}
            {item.featured && <FeaturedBadge cfg={cfg} />}
          </span>
          {price && d.itemStyle === "leaders" && (
            <>
              <span
                style={{
                  flex: 1,
                  borderBottom: `2px dotted ${d.colors.muted}66`,
                  transform: "translateY(-7px)",
                  minWidth: 28,
                }}
              />
              <span style={{ fontSize: 30, fontWeight: 600, color: d.colors.price, whiteSpace: "nowrap" }}>
                {price}
              </span>
            </>
          )}
          {price && d.itemStyle === "clean" && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 30,
                fontWeight: 600,
                color: d.colors.price,
                whiteSpace: "nowrap",
              }}
            >
              {price}
            </span>
          )}
          {price && d.itemStyle === "pills" && (
            <span
              style={{
                marginLeft: "auto",
                background: cfg.accent,
                color: "#FFFFFF",
                fontSize: 25,
                fontWeight: 600,
                padding: "7px 20px",
                borderRadius: 999,
                whiteSpace: "nowrap",
              }}
            >
              {price}
            </span>
          )}
        </div>
        {cfg.showDescriptions && item.description && (
          <div
            style={{
              fontSize: 21,
              color: d.colors.muted,
              marginTop: 4,
              lineHeight: 1.4,
              maxWidth: "90%",
            }}
          >
            {item.description}
          </div>
        )}
        <ItemExtras item={item} color={d.colors.muted} size={18} />
      </div>
    </div>
  );
}
