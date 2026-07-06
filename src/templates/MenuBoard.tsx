import type { Orientation, TemplateConfig, TemplateId } from "../lib/types";
import { DEFAULT_TEMPLATE_CONFIG } from "../lib/types";
import { boardDimensions, prepSections, type BoardData, type InnerProps } from "./shared";
export { boardDimensions } from "./shared";
import ClassicBoard from "./ClassicBoard";
import BoldBoard from "./BoldBoard";
import ChalkBoard from "./ChalkBoard";
import LuxeBoard from "./LuxeBoard";
import MarketBoard from "./MarketBoard";
import CustomBoard from "./CustomBoard";
import StudioBoard from "./StudioBoard";

export type { BoardData } from "./shared";

export const TEMPLATES: {
  id: TemplateId;
  name: string;
  blurb: string;
  defaultAccent: string;
}[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "Editorial serif, dotted leaders — quietly upscale",
    defaultAccent: "#FF6B2C",
  },
  {
    id: "bold",
    name: "Bold Board",
    blurb: "Condensed type, big prices — fast-food energy",
    defaultAccent: "#FF6B2C",
  },
  {
    id: "chalk",
    name: "Chalkboard",
    blurb: "Hand-written headings on grainy slate",
    defaultAccent: "#FFB020",
  },
  {
    id: "luxe",
    name: "Night Luxe",
    blurb: "Near-black, serif & hairlines — evening premium",
    defaultAccent: "#D4AF7A",
  },
  {
    id: "market",
    name: "Fresh Market",
    blurb: "Photo cards on a bright grid — image-forward",
    defaultAccent: "#22B573",
  },
  {
    id: "custom",
    name: "Your Design",
    blurb: "Build your own — layout, fonts & every color",
    defaultAccent: "#FF6B2C",
  },
];

const BOARDS: Record<TemplateId, (p: InnerProps) => JSX.Element> = {
  classic: ClassicBoard,
  bold: BoldBoard,
  chalk: ChalkBoard,
  luxe: LuxeBoard,
  market: MarketBoard,
  custom: CustomBoard,
};

interface BoardProps {
  data: BoardData;
  templateId: TemplateId;
  config: Partial<TemplateConfig>;
  orientation: Orientation;
}

const DENSITY_SCALE = { cozy: 1.12, standard: 1, compact: 0.86 } as const;

/** Renders a full menu board at native TV resolution (1920x1080 / 1080x1920). */
export default function MenuBoard({ data, templateId, config, orientation }: BoardProps) {
  const cfg: TemplateConfig = { ...DEFAULT_TEMPLATE_CONFIG, ...config };
  const { width, height } = boardDimensions(orientation);
  // Freeform studio designs win over the legacy preset-based custom board.
  const Board =
    templateId === "custom" && cfg.studio ? StudioBoard : (BOARDS[templateId] ?? ClassicBoard);
  const sections = prepSections(data.sections);
  const scale = DENSITY_SCALE[cfg.density] ?? 1;
  const footer = cfg.footerText.trim();

  return (
    <div style={{ width, height, overflow: "hidden", position: "relative" }}>
      <div
        style={{
          width: Math.round(width / scale),
          height: Math.round(height / scale),
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
        }}
      >
        {cfg.backgroundImage && (
          <div style={{ position: "absolute", inset: 0 }}>
            <img
              src={cfg.backgroundImage}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `rgba(10,13,18,${Math.min(80, Math.max(0, cfg.backgroundOverlay ?? 40)) / 100})`,
              }}
            />
          </div>
        )}
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <Board data={data} cfg={cfg} orientation={orientation} sections={sections} />
        </div>
      </div>
      {footer && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 68,
            background: "rgba(13,17,23,0.92)",
            borderTop: `3px solid ${cfg.accent}`,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            fontFamily: '"Poppins", sans-serif',
          }}
        >
          {cfg.footerTicker ? (
            <div
              style={{
                display: "flex",
                width: "max-content",
                whiteSpace: "nowrap",
                animation: "sm-ticker 28s linear infinite",
              }}
            >
              {[0, 1].map((i) => (
                <span key={i} style={{ fontSize: 27, fontWeight: 500, padding: "0 90px" }}>
                  {footer}
                </span>
              ))}
            </div>
          ) : (
            <span
              style={{
                fontSize: 27,
                fontWeight: 500,
                margin: "0 auto",
                padding: "0 48px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {footer}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
