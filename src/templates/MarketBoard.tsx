import type { MenuItem } from "../lib/types";
import { formatPrice } from "../lib/format";
import { FONTS, FeaturedBadge, ItemExtras, boardBg, headingFont, type InnerProps } from "./shared";
import AutoScrollPane from "./AutoScrollPane";

/**
 * Fresh Market — image-forward card grid. Soft tinted background,
 * photo cards with price badges. Made for juice bars & sandwich spots.
 */
export default function MarketBoard({ data, cfg, orientation, sections, autoScroll }: InnerProps) {
  const portrait = orientation === "portrait";
  const itemCols = portrait ? 2 : 4;
  const hFont = headingFont(cfg, FONTS.grotesk);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: boardBg(
          cfg,
          `radial-gradient(700px 500px at 88% -6%, ${cfg.accent}14 0%, transparent 70%),
           radial-gradient(800px 600px at -8% 104%, ${cfg.accent}10 0%, transparent 70%),
           #FAFBFC`
        ),
        color: "#1F2933",
        padding: portrait ? "60px 56px" : "56px 64px",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONTS.body,
        overflow: "hidden",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 40 }}>
        {cfg.showLogo && data.logoUrl && (
          <img
            src={data.logoUrl}
            alt=""
            style={{ height: 84, width: 84, objectFit: "contain", borderRadius: 20 }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              display: "inline-block",
              background: cfg.accent,
              color: "#FFFFFF",
              fontSize: 21,
              fontWeight: 600,
              padding: "7px 22px",
              borderRadius: 999,
            }}
          >
            {data.restaurantName}
          </span>
          <div
            style={{
              fontSize: portrait ? 60 : 68,
              fontWeight: 700,
              lineHeight: 1.05,
              marginTop: 10,
              fontFamily: hFont,
            }}
          >
            {data.menuName}
          </div>
        </div>
      </header>

      <AutoScrollPane enabled={autoScroll} style={{ flex: 1 }}>
        {sections.map((section) => (
          <section key={section.id} style={{ marginBottom: 40 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <h2 style={{ fontSize: 34, fontWeight: 600, fontFamily: hFont }}>
                {section.name}
              </h2>
              <span style={{ flex: 1, height: 2, background: `${cfg.accent}33`, borderRadius: 999 }} />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${itemCols}, 1fr)`,
                gap: 24,
              }}
            >
              {section.items.map((item) => (
                <ItemCard key={item.id} item={item} data={data} cfg={cfg} />
              ))}
            </div>
          </section>
        ))}
      </AutoScrollPane>
    </div>
  );
}

function ItemCard({
  item,
  data,
  cfg,
}: {
  item: MenuItem;
  data: InnerProps["data"];
  cfg: InnerProps["cfg"];
}) {
  const showPhoto = cfg.showImages && item.image_url;
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 22,
        overflow: "hidden",
        boxShadow: "0 8px 26px rgba(31,41,51,0.08)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {showPhoto ? (
        <img
          src={item.image_url!}
          alt=""
          style={{ width: "100%", height: 148, objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            height: 12,
            background: `linear-gradient(90deg, ${cfg.accent}, ${cfg.accent}66)`,
          }}
        />
      )}
      <div style={{ padding: "18px 22px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>
          {item.name}
          {item.featured && <FeaturedBadge cfg={cfg} />}
        </div>
        {cfg.showDescriptions && item.description && (
          <div
            style={{
              fontSize: 18,
              color: "#5B6672",
              lineHeight: 1.4,
              marginTop: 6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.description}
          </div>
        )}
        <ItemExtras item={item} color="#5B6672" size={16} />
        {cfg.showPrices && (
          <div style={{ marginTop: "auto", paddingTop: 14 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: cfg.accent, fontFamily: FONTS.grotesk }}>
              {formatPrice(item.price, data.currency)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
