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
 * Night Luxe — premium evening board. Near-black with a soft vignette,
 * Fraunces serif, hairline dividers, letterspaced small caps.
 * Accent reads best in gold/amber but follows the user's choice.
 */
export default function LuxeBoard({ data, cfg, orientation, sections, autoScroll }: InnerProps) {
  const cream = "#F3EDE3";
  const faint = "rgba(243,237,227,0.5)";
  const hairline = "rgba(243,237,227,0.14)";
  const columns = columnsFor(orientation, sections.length, cfg.columns);
  const hFont = headingFont(cfg, FONTS.serif);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: boardBg(
          cfg,
          "radial-gradient(1400px 700px at 50% -10%, #1A212B 0%, #0D1117 62%, #0A0D12 100%)"
        ),
        color: cream,
        padding: orientation === "portrait" ? "76px 72px" : "64px 88px",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONTS.body,
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 56 }}>
        {cfg.showLogo && data.logoUrl && (
          <img
            src={data.logoUrl}
            alt=""
            style={{
              height: 80,
              width: 80,
              objectFit: "contain",
              borderRadius: 18,
              margin: "0 auto 20px",
            }}
          />
        )}
        <div
          style={{
            fontSize: 23,
            letterSpacing: 9,
            textTransform: "uppercase",
            color: cfg.accent,
            fontWeight: 500,
          }}
        >
          {data.restaurantName}
        </div>
        <div
          style={{
            fontFamily: hFont,
            fontSize: orientation === "portrait" ? 78 : 92,
            fontWeight: 500,
            lineHeight: 1.05,
            marginTop: 12,
          }}
        >
          {data.menuName}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            marginTop: 26,
          }}
        >
          <span style={{ width: 130, height: 1, background: hairline }} />
          <span style={{ color: cfg.accent, fontSize: 20 }}>✦</span>
          <span style={{ width: 130, height: 1, background: hairline }} />
        </div>
      </header>

      <AutoScrollPane
        enabled={autoScroll}
        style={{ flex: 1, columnCount: columns, columnGap: 96, columnRule: `1px solid ${hairline}` }}
      >
        {sections.map((section) => (
          <section key={section.id} style={{ breakInside: "avoid", marginBottom: 56 }}>
            <h2
              style={{
                fontSize: 27,
                fontWeight: 600,
                letterSpacing: 5,
                textTransform: "uppercase",
                color: cfg.accent,
                marginBottom: 28,
              }}
            >
              {section.name}
            </h2>
            {section.items.map((item) => (
              <div key={item.id} style={{ marginBottom: 28, display: "flex", gap: 18 }}>
                {cfg.showImages && <ItemImage item={item} size={64} radius={12} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 24,
                    }}
                  >
                    <span style={{ fontSize: 29, fontWeight: 500 }}>
                      {item.name}
                      {item.featured && <FeaturedBadge cfg={cfg} />}
                    </span>
                    {cfg.showPrices && (
                      <span
                        style={{
                          fontFamily: FONTS.serif,
                          fontSize: 30,
                          fontWeight: 600,
                          color: cfg.accent,
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
                        fontFamily: FONTS.serif,
                        fontStyle: "italic",
                        fontSize: 21,
                        color: faint,
                        marginTop: 6,
                        lineHeight: 1.45,
                        maxWidth: "90%",
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
  );
}
