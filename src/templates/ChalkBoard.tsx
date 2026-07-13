import { formatPrice } from "../lib/format";
import {
  FONTS,
  FeaturedBadge,
  ItemExtras,
  ItemImage,
  NOISE_URL,
  boardBg,
  columnsFor,
  headingFont,
  type InnerProps,
} from "./shared";
import AutoScrollPane from "./AutoScrollPane";

function Squiggle({ color }: { color: string }) {
  return (
    <svg width="150" height="12" viewBox="0 0 150 12" style={{ display: "block" }}>
      <path
        d="M2 8 Q 18 2, 36 7 T 72 7 T 108 7 T 148 6"
        stroke={color}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Chalkboard — hand-shop charm. Grainy slate board, chalk-white frame,
 * Caveat handwriting for headings and prices.
 */
export default function ChalkBoard({ data, cfg, orientation, sections, autoScroll }: InnerProps) {
  const columns = columnsFor(orientation, sections.length, cfg.columns);
  const chalk = "#F2F4F6";
  const faint = "rgba(242,244,246,0.55)";
  const hFont = headingFont(cfg, FONTS.chalk);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: boardBg(
          cfg,
          "radial-gradient(ellipse at 25% 15%, #333F4B 0%, #232D38 45%, #1A222C 100%)"
        ),
        color: chalk,
        padding: 40,
        fontFamily: FONTS.body,
        position: "relative",
      }}
    >
      {/* grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: NOISE_URL,
          opacity: 0.16,
          pointerEvents: "none",
        }}
      />
      {/* chalk frame */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          border: "3px solid rgba(242,244,246,0.35)",
          borderRadius: 26,
          padding: orientation === "portrait" ? "52px 56px" : "44px 64px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: 44 }}>
          {cfg.showLogo && data.logoUrl && (
            <img
              src={data.logoUrl}
              alt=""
              style={{
                height: 78,
                width: 78,
                objectFit: "contain",
                borderRadius: 16,
                margin: "0 auto 12px",
              }}
            />
          )}
          <div
            style={{
              fontSize: 24,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: faint,
              fontWeight: 500,
            }}
          >
            {data.restaurantName}
          </div>
          <div
            style={{
              fontFamily: hFont,
              fontSize: orientation === "portrait" ? 96 : 108,
              fontWeight: 700,
              lineHeight: 1,
              color: cfg.accent,
              marginTop: 4,
            }}
          >
            {data.menuName}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
            <Squiggle color="rgba(242,244,246,0.5)" />
          </div>
        </header>

        <AutoScrollPane enabled={autoScroll} style={{ flex: 1, columnCount: columns, columnGap: 84 }}>
          {sections.map((section) => (
            <section key={section.id} style={{ breakInside: "avoid", marginBottom: 50 }}>
              <h2
                style={{
                  fontFamily: hFont,
                  fontSize: 58,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: cfg.accent,
                  marginBottom: 6,
                }}
              >
                {section.name}
              </h2>
              <div style={{ marginBottom: 24 }}>
                <Squiggle color={`${cfg.accent}88`} />
              </div>
              {section.items.map((item) => (
                <div key={item.id} style={{ marginBottom: 24, display: "flex", gap: 18 }}>
                  {cfg.showImages && <ItemImage item={item} size={66} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 18,
                      }}
                    >
                      <span style={{ fontSize: 29, fontWeight: 500 }}>
                        {item.name}
                        {item.featured && <FeaturedBadge cfg={cfg} />}
                      </span>
                      {cfg.showPrices && (
                        <span
                          style={{
                            fontFamily: FONTS.chalk,
                            fontSize: 42,
                            fontWeight: 700,
                            lineHeight: 1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatPrice(item.price, data.currency)}
                        </span>
                      )}
                    </div>
                    {cfg.showDescriptions && item.description && (
                      <div
                        style={{
                          fontSize: 20,
                          color: faint,
                          marginTop: 4,
                          lineHeight: 1.4,
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                    <ItemExtras item={item} color={faint} size={18} />
                  </div>
                </div>
              ))}
            </section>
          ))}
        </AutoScrollPane>
      </div>
    </div>
  );
}
