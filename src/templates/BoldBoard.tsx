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
import AutoScrollPane from "./AutoScrollPane";

/**
 * Bold Board — fast-food energy. Bebas Neue condensed display, accent
 * header band, section cards with a thick accent spine, big prices.
 */
export default function BoldBoard({ data, cfg, orientation, sections, autoScroll }: InnerProps) {
  const dark = cfg.theme === "dark";
  const bg = boardBg(cfg, dark ? "#12181F" : "#F2F4F7");
  const hFont = headingFont(cfg, FONTS.condensed);
  const cardBg = dark ? "#1D2630" : "#FFFFFF";
  const text = dark ? "#F5F7FA" : "#1F2933";
  const sub = dark ? "#95A0AC" : "#5B6672";
  const columns = columnsFor(orientation, sections.length, cfg.columns);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: bg,
        color: text,
        display: "flex",
        flexDirection: "column",
        fontFamily: FONTS.body,
      }}
    >
      <header
        style={{
          background: `linear-gradient(120deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.22) 100%), ${cfg.accent}`,
          color: "#FFFFFF",
          padding: orientation === "portrait" ? "44px 56px" : "34px 64px",
          display: "flex",
          alignItems: "center",
          gap: 30,
        }}
      >
        {cfg.showLogo && data.logoUrl && (
          <img
            src={data.logoUrl}
            alt=""
            style={{
              height: 100,
              width: 100,
              objectFit: "contain",
              borderRadius: 24,
              background: "rgba(255,255,255,0.16)",
              padding: 8,
            }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 600, opacity: 0.92, letterSpacing: 1 }}>
            {data.restaurantName}
          </div>
          <div
            style={{
              fontFamily: hFont,
              fontSize: orientation === "portrait" ? 96 : 112,
              lineHeight: 0.95,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {data.menuName}
          </div>
        </div>
      </header>

      <AutoScrollPane
        enabled={autoScroll}
        style={{
          flex: 1,
          padding: orientation === "portrait" ? 48 : 56,
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 36,
          alignContent: "start",
        }}
      >
        {sections.map((section) => (
          <section
            key={section.id}
            style={{
              background: cardBg,
              borderRadius: 24,
              padding: "34px 36px",
              borderTop: `10px solid ${cfg.accent}`,
              boxShadow: dark ? "none" : "0 10px 30px rgba(31,41,51,0.07)",
            }}
          >
            <h2
              style={{
                fontFamily: hFont,
                fontSize: 52,
                letterSpacing: 2,
                textTransform: "uppercase",
                lineHeight: 1,
                marginBottom: 26,
              }}
            >
              {section.name}
            </h2>
            {section.items.map((item) => (
              <div
                key={item.id}
                style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}
              >
                {cfg.showImages && <ItemImage item={item} size={82} radius={16} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 29, fontWeight: 600 }}>
                    {item.name}
                    {item.featured && <FeaturedBadge cfg={cfg} />}
                  </div>
                  {cfg.showDescriptions && item.description && (
                    <div style={{ fontSize: 20, color: sub, lineHeight: 1.35, marginTop: 2 }}>
                      {item.description}
                    </div>
                  )}
                  <ItemExtras item={item} color={sub} size={18} />
                </div>
                {cfg.showPrices && (
                  <span
                    style={{
                      fontFamily: FONTS.condensed,
                      fontSize: 46,
                      lineHeight: 1,
                      color: cfg.accent,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatPrice(item.price, data.currency)}
                  </span>
                )}
              </div>
            ))}
          </section>
        ))}
      </AutoScrollPane>
    </div>
  );
}
