import type { MenuItem } from "../lib/types";
import { formatPrice } from "../lib/format";
import {
  FONTS,
  FeaturedBadge,
  ItemExtras,
  ItemImage,
  catalogSections,
  headingFont,
  resolveHeroItem,
  type InnerProps,
} from "./shared";
import { HeroPanel, SplitLayout } from "./primitives";
import AutoScrollPane from "./AutoScrollPane";

/**
 * Spotlight — split hero + catalog. Left panel showcases a featured item;
 * right side shows categorized grid with thumbnails.
 */
export default function SpotlightBoard({ data, cfg, orientation, sections, autoScroll }: InnerProps) {
  const portrait = orientation === "portrait";
  const hero = resolveHeroItem(sections, cfg);
  const catalog = catalogSections(sections, hero);
  const hFont = headingFont(cfg, FONTS.bricolage);
  const ratio = cfg.layoutRatio ?? "40-60";

  const heroPanel = (
    <HeroPanel
      accent={cfg.accent}
      dark
      imageUrl={cfg.showImages ? hero?.image_url : null}
      title={hero?.name ?? data.menuName}
      subtitle={cfg.showDescriptions ? hero?.description : undefined}
      price={cfg.showPrices && hero ? formatPrice(hero.price, data.currency) : undefined}
      badge={hero?.featured ? (
        <div style={{ marginBottom: 16 }}>
          <FeaturedBadge cfg={cfg} />
        </div>
      ) : undefined}
    />
  );

  const catalogPanel = (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#FFFFFF",
        padding: portrait ? "40px 36px" : "44px 48px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: FONTS.body,
        color: "#1F2933",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 28,
          flexShrink: 0,
          paddingBottom: 24,
          borderBottom: "1px solid #E4E7EB",
        }}
      >
        {cfg.showLogo && data.logoUrl && (
          <img src={data.logoUrl} alt="" style={{ height: 64, width: 64, objectFit: "contain", borderRadius: 14 }} />
        )}
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#7B8794", letterSpacing: 0.3 }}>
            {data.restaurantName}
          </div>
          <div
            style={{
              fontSize: portrait ? 36 : 42,
              fontWeight: 700,
              fontFamily: hFont,
              lineHeight: 1.05,
              color: "#1F2933",
            }}
          >
            {data.menuName}
          </div>
        </div>
      </header>
      <AutoScrollPane enabled={autoScroll} style={{ flex: 1 }}>
        {catalog.map((section) => (
          <section key={section.id} style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                fontFamily: hFont,
                marginBottom: 16,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                color: cfg.accent,
              }}
            >
              {section.name}
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {section.items.map((item) => (
                <CatalogRow key={item.id} item={item} data={data} cfg={cfg} />
              ))}
            </div>
          </section>
        ))}
      </AutoScrollPane>
    </div>
  );

  if (portrait) {
    return (
      <SplitLayout ratio="50-50" direction="column" left={heroPanel} right={catalogPanel} />
    );
  }

  return <SplitLayout ratio={ratio} left={heroPanel} right={catalogPanel} />;
}

function CatalogRow({
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
        gap: 16,
        padding: "12px 14px",
        borderRadius: 14,
        background: "#F7F9FB",
      }}
    >
      {cfg.showImages && item.image_url && (
        <ItemImage item={item} size={72} radius={12} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2, color: "#1F2933" }}>
          {item.name}
          {item.featured && <FeaturedBadge cfg={cfg} />}
        </div>
        {cfg.showDescriptions && item.description && (
          <div
            style={{
              fontSize: 15,
              color: "#5B6672",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.description}
          </div>
        )}
        <ItemExtras item={item} color="#5B6672" size={14} />
      </div>
      {cfg.showPrices && (
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#1F2933",
            fontFamily: FONTS.grotesk,
            flexShrink: 0,
          }}
        >
          {formatPrice(item.price, data.currency)}
        </div>
      )}
    </div>
  );
}
