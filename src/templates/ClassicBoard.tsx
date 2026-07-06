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

/**
 * Classic — editorial café board. Cream paper, Fraunces serif display,
 * hairline rules, dotted price leaders. Quietly upscale.
 */
export default function ClassicBoard({ data, cfg, orientation, sections }: InnerProps) {
  const dark = cfg.theme === "dark";
  const bg = boardBg(cfg, dark ? "#181F26" : "#FFFDF8");
  const hFont = headingFont(cfg, FONTS.serif);
  const text = dark ? "#F2EFE9" : "#22282F";
  const sub = dark ? "#9AA5B1" : "#6B7480";
  const hairline = dark ? "rgba(242,239,233,0.18)" : "rgba(34,40,47,0.16)";
  const columns = columnsFor(orientation, sections.length, cfg.columns);
  const pad = orientation === "portrait" ? 72 : 80;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: bg,
        color: text,
        padding: pad,
        display: "flex",
        flexDirection: "column",
        fontFamily: FONTS.body,
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 52 }}>
        {cfg.showLogo && data.logoUrl && (
          <img
            src={data.logoUrl}
            alt=""
            style={{
              height: 76,
              width: 76,
              objectFit: "contain",
              borderRadius: 16,
              margin: "0 auto 18px",
            }}
          />
        )}
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: 7,
            textTransform: "uppercase",
            color: cfg.accent,
          }}
        >
          {data.restaurantName}
        </div>
        <div
          style={{
            fontFamily: hFont,
            fontSize: orientation === "portrait" ? 76 : 88,
            fontWeight: 600,
            lineHeight: 1.05,
            marginTop: 10,
          }}
        >
          {data.menuName}
        </div>
        <div
          style={{
            margin: "28px auto 0",
            width: 620,
            maxWidth: "80%",
            borderTop: `1px solid ${hairline}`,
            borderBottom: `1px solid ${hairline}`,
            height: 7,
          }}
        />
      </header>

      <div style={{ flex: 1, columnCount: columns, columnGap: 88, overflow: "hidden" }}>
        {sections.map((section) => (
          <section key={section.id} style={{ breakInside: "avoid", marginBottom: 54 }}>
            <h2
              style={{
                fontFamily: hFont,
                fontSize: 40,
                fontWeight: 600,
                color: cfg.accent,
                marginBottom: 8,
              }}
            >
              {section.name}
            </h2>
            <div
              style={{
                width: 52,
                height: 3,
                background: cfg.accent,
                borderRadius: 999,
                marginBottom: 26,
              }}
            />
            {section.items.map((item) => (
              <div key={item.id} style={{ marginBottom: 24, display: "flex", gap: 18 }}>
                {cfg.showImages && <ItemImage item={item} size={68} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                    <span style={{ fontSize: 29, fontWeight: 500 }}>
                      {item.name}
                      {item.featured && <FeaturedBadge cfg={cfg} />}
                    </span>
                    {cfg.showPrices && (
                      <>
                        <span
                          style={{
                            flex: 1,
                            borderBottom: `2px dotted ${hairline}`,
                            transform: "translateY(-7px)",
                            minWidth: 28,
                          }}
                        />
                        <span
                          style={{
                            fontFamily: FONTS.serif,
                            fontSize: 30,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatPrice(item.price, data.currency)}
                        </span>
                      </>
                    )}
                  </div>
                  {cfg.showDescriptions && item.description && (
                    <div
                      style={{
                        fontSize: 21,
                        color: sub,
                        marginTop: 5,
                        lineHeight: 1.45,
                        maxWidth: "88%",
                      }}
                    >
                      {item.description}
                    </div>
                  )}
                  <ItemExtras item={item} color={sub} />
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
