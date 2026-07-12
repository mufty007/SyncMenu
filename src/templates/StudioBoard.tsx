import type { Orientation, StudioDoc, StudioElement, TemplateId } from "../lib/types";
import { formatPrice } from "../lib/format";
import { QRCodeSVG } from "qrcode.react";
import {
  FONTS,
  FONT_FAMILY,
  ItemExtras,
  boardBg,
  boardDimensions,
  type BoardData,
  type InnerProps,
} from "./shared";

/* ------------------------------------------------------------------ */
/* Single element renderer (shared by player and the studio editor)    */
/* ------------------------------------------------------------------ */

export function StudioElementView({
  el,
  data,
  editing = false,
}: {
  el: StudioElement;
  data: BoardData;
  editing?: boolean;
}) {
  const base: React.CSSProperties = { width: "100%", height: "100%", overflow: "hidden" };

  switch (el.type) {
    case "text":
    case "menuName":
    case "restaurantName": {
      const text =
        el.type === "menuName"
          ? data.menuName
          : el.type === "restaurantName"
            ? data.restaurantName
            : (el.text ?? "");
      return (
        <div
          style={{
            ...base,
            fontFamily: FONT_FAMILY[el.fontFamily ?? "poppins"],
            fontSize: el.fontSize ?? 28,
            fontWeight: el.fontWeight ?? 500,
            color: el.color ?? "#1F2933",
            textAlign: el.align ?? "left",
            lineHeight: 1.15,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {text || (editing ? "Double-click to edit…" : "")}
        </div>
      );
    }
    case "shape":
      return (
        <div
          style={{
            ...base,
            background: el.fill ?? "#FF6B2C",
            borderRadius: el.radius ?? 16,
            opacity: (el.opacity ?? 100) / 100,
          }}
        />
      );
    case "image":
      return el.url ? (
        <img
          src={el.url}
          alt=""
          draggable={false}
          style={{
            ...base,
            objectFit: "cover",
            borderRadius: el.radius ?? 12,
            opacity: (el.opacity ?? 100) / 100,
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            ...base,
            borderRadius: el.radius ?? 12,
            background: "#E4E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#52606D",
            fontSize: 20,
            fontFamily: FONTS.body,
          }}
        >
          {editing ? "No image" : ""}
        </div>
      );
    case "gif":
      return el.url ? (
        <img
          src={el.url}
          alt=""
          draggable={false}
          style={{
            ...base,
            objectFit: "cover",
            borderRadius: el.radius ?? 12,
            opacity: (el.opacity ?? 100) / 100,
            display: "block",
          }}
        />
      ) : (
        <div style={{ ...base, background: "#E4E7EB", borderRadius: el.radius ?? 12 }} />
      );
    case "video":
      return el.url ? (
        <video
          autoPlay
          loop={el.loop !== false}
          muted={el.muted !== false}
          playsInline
          src={el.url}
          style={{
            ...base,
            objectFit: "cover",
            borderRadius: el.radius ?? 12,
            opacity: (el.opacity ?? 100) / 100,
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            ...base,
            borderRadius: el.radius ?? 12,
            background: "#1A2026",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9AA5B1",
            fontSize: 18,
            fontFamily: FONTS.body,
          }}
        >
          {editing ? "No video" : ""}
        </div>
      );
    case "qrCode":
      return el.linkUrl ? (
        <div
          style={{
            ...base,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FFFFFF",
            borderRadius: el.radius ?? 12,
            padding: 8,
          }}
        >
          <QRCodeSVG value={el.linkUrl} width="90%" height="90%" />
        </div>
      ) : (
        <div
          style={{
            ...base,
            border: editing ? "2px dashed #9AA5B1" : "none",
            borderRadius: el.radius ?? 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9AA5B1",
            fontSize: 16,
            fontFamily: FONTS.body,
            textAlign: "center",
            padding: 8,
          }}
        >
          {editing ? "Set link URL" : ""}
        </div>
      );
    case "logo":
      return data.logoUrl ? (
        <img
          src={data.logoUrl}
          alt=""
          draggable={false}
          style={{ ...base, objectFit: "contain", display: "block" }}
        />
      ) : (
        <div
          style={{
            ...base,
            border: editing ? "2px dashed #9AA5B1" : "none",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9AA5B1",
            fontSize: 18,
            fontFamily: FONTS.body,
          }}
        >
          {editing ? "Logo (upload in Settings)" : ""}
        </div>
      );
    case "section": {
      const section = data.sections.find((s) => s.id === el.sectionId);
      if (!section) {
        return editing ? (
          <div
            style={{
              ...base,
              border: "2px dashed #E5484D",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#E5484D",
              fontSize: 20,
              fontFamily: FONTS.body,
            }}
          >
            Section was deleted
          </div>
        ) : (
          <div style={base} />
        );
      }
      const items = section.items
        .filter((i) => i.available)
        .sort((a, b) => a.sort_order - b.sort_order);
      const size = el.itemFontSize ?? 28;
      return (
        <div style={{ ...base, fontFamily: FONT_FAMILY[el.fontFamily ?? "poppins"] }}>
          {(el.showTitle ?? true) && (
            <div
              style={{
                fontSize: size * 1.35,
                fontWeight: 700,
                color: el.titleColor ?? "#FF6B2C",
                marginBottom: size * 0.5,
                lineHeight: 1.1,
              }}
            >
              {section.name}
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} style={{ marginBottom: size * 0.55 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span
                  style={{
                    fontSize: size,
                    fontWeight: 500,
                    color: el.textColor ?? "#1F2933",
                  }}
                >
                  {item.name}
                </span>
                {(el.showPrice ?? true) && (
                  <>
                    <span
                      style={{
                        flex: 1,
                        borderBottom: `2px dotted ${el.mutedColor ?? "#9AA5B1"}66`,
                        transform: "translateY(-5px)",
                        minWidth: 20,
                      }}
                    />
                    <span
                      style={{
                        fontSize: size,
                        fontWeight: 600,
                        color: el.priceColor ?? "#1F2933",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatPrice(item.price, data.currency)}
                    </span>
                  </>
                )}
              </div>
              {(el.showDesc ?? true) && item.description && (
                <div
                  style={{
                    fontSize: size * 0.72,
                    color: el.mutedColor ?? "#52606D",
                    lineHeight: 1.35,
                    marginTop: 2,
                  }}
                >
                  {item.description}
                </div>
              )}
              <ItemExtras
                item={item}
                color={el.mutedColor ?? "#52606D"}
                size={Math.round(size * 0.65)}
              />
            </div>
          ))}
        </div>
      );
    }
    default:
      return <div style={base} />;
  }
}

/* ------------------------------------------------------------------ */
/* Full board renderer for player / previews                           */
/* ------------------------------------------------------------------ */

export default function StudioBoard({ data, cfg }: InnerProps) {
  const doc = cfg.studio ?? { elements: [] };
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: boardBg(cfg, "#FFFFFF"),
        overflow: "hidden",
      }}
    >
      {doc.elements.map((el) => (
        <div
          key={el.id}
          style={{
            position: "absolute",
            left: el.x,
            top: el.y,
            width: el.w,
            height: el.h,
          }}
        >
          <StudioElementView el={el} data={data} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Starting layout when a menu first enters the studio                 */
/* ------------------------------------------------------------------ */

export function scaffoldStudio(
  orientation: Orientation,
  sections: BoardData["sections"],
  accent: string
): StudioDoc {
  const { width, height } = boardDimensions(orientation);
  const margin = 80;
  const uid = () => crypto.randomUUID();
  const elements: StudioElement[] = [
    {
      id: uid(),
      type: "restaurantName",
      x: margin,
      y: 52,
      w: width - margin * 2,
      h: 44,
      fontSize: 26,
      fontWeight: 500,
      color: accent,
      align: "center",
      fontFamily: "poppins",
    },
    {
      id: uid(),
      type: "menuName",
      x: margin,
      y: 100,
      w: width - margin * 2,
      h: 110,
      fontSize: 88,
      fontWeight: 700,
      color: "#1F2933",
      align: "center",
      fontFamily: "grotesk",
    },
    {
      id: uid(),
      type: "shape",
      x: width / 2 - 60,
      y: 224,
      w: 120,
      h: 8,
      fill: accent,
      radius: 999,
    },
  ];

  const cols = orientation === "portrait" ? 1 : Math.min(3, Math.max(1, sections.length));
  const gap = 56;
  const colW = (width - margin * 2 - gap * (cols - 1)) / cols;
  const top = 280;
  const blockH = Math.min(560, height - top - margin);
  sections.slice(0, 6).forEach((section, i) => {
    elements.push({
      id: uid(),
      type: "section",
      sectionId: section.id,
      x: margin + (i % cols) * (colW + gap),
      y: top + Math.floor(i / cols) * (blockH + 48),
      w: colW,
      h: blockH,
      itemFontSize: 28,
      titleColor: accent,
      textColor: "#1F2933",
      mutedColor: "#52606D",
      priceColor: "#1F2933",
      showTitle: true,
      showDesc: true,
      showPrice: true,
      fontFamily: "poppins",
    });
  });

  return { elements };
}

/** Starter layouts based on premium templates. */
export function scaffoldFromTemplate(
  templateId: TemplateId,
  orientation: Orientation,
  sections: BoardData["sections"],
  accent: string
): StudioDoc {
  const { width, height } = boardDimensions(orientation);
  const uid = () => crypto.randomUUID();
  const portrait = orientation === "portrait";

  if (templateId === "spotlight") {
    const heroW = portrait ? width : Math.round(width * 0.38);
    const catalogX = portrait ? 0 : heroW;
    const catalogY = portrait ? Math.round(height * 0.5) : 0;
    const catalogW = portrait ? width : width - heroW;
    return {
      elements: [
        { id: uid(), type: "shape", x: 0, y: 0, w: heroW, h: portrait ? catalogY : height, fill: accent, radius: 0, opacity: 100 },
        { id: uid(), type: "menuName", x: catalogX + 48, y: catalogY + 40, w: catalogW - 96, h: 80, fontSize: 48, fontWeight: 700, fontFamily: "bricolage", color: "#1F2933", align: "left" },
        ...sections.slice(0, 2).map((section, i) => ({
          id: uid(),
          type: "section" as const,
          sectionId: section.id,
          x: catalogX + 48,
          y: catalogY + 140 + i * 280,
          w: catalogW - 96,
          h: 260,
          itemFontSize: 24,
          titleColor: accent,
          textColor: "#1F2933",
          mutedColor: "#52606D",
          priceColor: accent,
          showTitle: true,
          showDesc: true,
          showPrice: true,
          fontFamily: "poppins" as const,
        })),
      ],
    };
  }

  if (templateId === "vivid") {
    const cols = portrait ? 1 : 2;
    const rows = portrait ? 4 : 2;
    const gap = 12;
    const pad = 32;
    const cellW = (width - pad * 2 - gap * (cols - 1)) / cols;
    const cellH = (height - pad * 2 - gap * (rows - 1) - 80) / rows;
    return {
      elements: [
        { id: uid(), type: "menuName", x: pad, y: 24, w: width - pad * 2, h: 56, fontSize: 52, fontWeight: 700, fontFamily: "bebas", color: "#1F2933", align: "left" },
        ...sections.slice(0, 4).map((section, i) => {
          const col = portrait ? 0 : i % cols;
          const row = portrait ? i : Math.floor(i / cols);
          return {
            id: uid(),
            type: "section" as const,
            sectionId: section.id,
            x: pad + col * (cellW + gap),
            y: 96 + row * (cellH + gap),
            w: cellW,
            h: cellH,
            itemFontSize: 20,
            titleColor: "#FFFFFF",
            textColor: "#FFFFFF",
            mutedColor: "rgba(255,255,255,0.75)",
            priceColor: "#FFFFFF",
            showTitle: true,
            showDesc: false,
            showPrice: true,
            fontFamily: "poppins" as const,
          };
        }),
      ],
    };
  }

  if (templateId === "promo") {
    return {
      elements: [
        { id: uid(), type: "shape", x: 0, y: 0, w: width, h: height, fill: accent, radius: 0, opacity: 100 },
        { id: uid(), type: "menuName", x: 80, y: height - 200, w: width - 160, h: 100, fontSize: 72, fontWeight: 700, fontFamily: "bricolage", color: "#FFFFFF", align: "center" },
        ...sections.slice(0, 1).map((section) => ({
          id: uid(),
          type: "section" as const,
          sectionId: section.id,
          x: portrait ? 40 : width - 420,
          y: portrait ? height - 380 : 80,
          w: portrait ? width - 80 : 360,
          h: portrait ? 160 : height - 160,
          itemFontSize: 22,
          titleColor: "#FFFFFF",
          textColor: "#FFFFFF",
          mutedColor: "rgba(255,255,255,0.8)",
          priceColor: "#FFFFFF",
          showTitle: true,
          showDesc: false,
          showPrice: true,
          fontFamily: "poppins" as const,
        })),
      ],
    };
  }

  return scaffoldStudio(orientation, sections, accent);
}
