import type { CSSProperties, ReactNode } from "react";
import { FONTS } from "./shared";

export type LayoutRatio = "40-60" | "50-50" | "33-67";

const RATIO_MAP: Record<LayoutRatio, [number, number]> = {
  "40-60": [38, 62],
  "50-50": [50, 50],
  "33-67": [33, 67],
};

interface SplitLayoutProps {
  ratio?: LayoutRatio;
  direction?: "row" | "column";
  left: ReactNode;
  right: ReactNode;
  gap?: number;
  style?: CSSProperties;
}

/** Two-panel split layout with configurable column ratios. */
export function SplitLayout({
  ratio = "40-60",
  direction = "row",
  left,
  right,
  gap = 0,
  style,
}: SplitLayoutProps) {
  const [a, b] = RATIO_MAP[ratio];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        width: "100%",
        height: "100%",
        gap,
        overflow: "hidden",
        ...style,
      }}
    >
      <div style={{ flex: `${a} 1 0`, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        {left}
      </div>
      <div style={{ flex: `${b} 1 0`, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        {right}
      </div>
    </div>
  );
}

interface PriceBadgeProps {
  price: string;
  size?: "sm" | "md" | "lg";
  variant?: "circle" | "pill";
  color?: string;
  textColor?: string;
}

/** Circular or pill price callout (Sign Laban style). */
export function PriceBadge({
  price,
  size = "md",
  variant = "circle",
  color = "#FFFFFF",
  textColor = "#1F2933",
}: PriceBadgeProps) {
  const sizes = {
    sm: { font: 28, pad: variant === "circle" ? 48 : "10px 22px" },
    md: { font: 36, pad: variant === "circle" ? 64 : "14px 28px" },
    lg: { font: 52, pad: variant === "circle" ? 88 : "18px 36px" },
  }[size];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: color,
        color: textColor,
        fontFamily: FONTS.grotesk,
        fontWeight: 700,
        fontSize: sizes.font,
        lineHeight: 1,
        borderRadius: variant === "circle" ? "50%" : 999,
        width: variant === "circle" ? sizes.pad : undefined,
        height: variant === "circle" ? sizes.pad : undefined,
        padding: variant === "pill" ? sizes.pad : undefined,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}
    >
      {price}
    </div>
  );
}

interface PhotoCutoutProps {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  shadow?: boolean;
  style?: CSSProperties;
}

/** Product photo with optional drop shadow, no box border. */
export function PhotoCutout({
  src,
  alt = "",
  width = "100%",
  height = "auto",
  shadow = true,
  style,
}: PhotoCutoutProps) {
  return (
    <img
      src={src}
      alt={alt}
      style={{
        width,
        height,
        objectFit: "contain",
        display: "block",
        filter: shadow ? "drop-shadow(0 16px 40px rgba(0,0,0,0.28))" : undefined,
        ...style,
      }}
    />
  );
}

interface HeroPanelProps {
  accent: string;
  dark?: boolean;
  imageUrl?: string | null;
  title: string;
  subtitle?: string;
  price?: string;
  badge?: ReactNode;
  children?: ReactNode;
}

/** Full-bleed hero panel — image or gradient fills the panel; text sits on a bottom vignette. */
export function HeroPanel({
  accent,
  dark = true,
  imageUrl,
  title,
  subtitle,
  price,
  badge,
  children,
}: HeroPanelProps) {
  const bg = dark
    ? `linear-gradient(165deg, ${accent} 0%, ${shade(accent, -30)} 100%)`
    : `linear-gradient(165deg, ${accent}18 0%, #FFFFFF 100%)`;
  const text = dark ? "#FFFFFF" : "#1F2933";
  const sub = dark ? "rgba(255,255,255,0.88)" : "#52606D";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        fontFamily: FONTS.body,
        color: text,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: bg }} />
      )}

      {!imageUrl && <DecorativeBlob color={dark ? "#FFFFFF" : accent} opacity={dark ? 0.08 : 0.12} />}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: imageUrl
            ? "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 32%, rgba(0,0,0,0.12) 58%, transparent 78%)"
            : dark
              ? "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 45%)"
              : undefined,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "44px 40px 48px",
          textAlign: "left",
          zIndex: 1,
        }}
      >
        {badge}
        <div
          style={{
            fontFamily: FONTS.bricolage,
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.05,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: dark || imageUrl ? "#FFFFFF" : text,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 22,
              color: imageUrl || dark ? "rgba(255,255,255,0.88)" : sub,
              marginTop: 10,
              lineHeight: 1.4,
              maxWidth: 480,
            }}
          >
            {subtitle}
          </div>
        )}
        {price && (
          <div
            style={{
              marginTop: 18,
              fontFamily: FONTS.grotesk,
              fontSize: 44,
              fontWeight: 700,
              lineHeight: 1,
              color: dark || imageUrl ? "#FFFFFF" : text,
              letterSpacing: -0.5,
            }}
          >
            {price}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

interface CategoryZoneProps {
  accent: string;
  title: string;
  children: ReactNode;
  dark?: boolean;
}

/** Color-blocked category zone with header band. */
export function CategoryZone({ accent, title, children, dark }: CategoryZoneProps) {
  const bg = dark ? shade(accent, -45) : `${accent}12`;
  const band = dark ? accent : accent;
  const text = dark ? "#FFFFFF" : "#1F2933";

  return (
    <div
      style={{
        background: bg,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: FONTS.body,
      }}
    >
      <div
        style={{
          background: band,
          color: "#FFFFFF",
          padding: "14px 20px",
          fontFamily: FONTS.condensed,
          fontSize: 32,
          letterSpacing: 2,
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        {title}
      </div>
      <div style={{ flex: 1, padding: "16px 20px", color: text, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

interface DecorativeBlobProps {
  color?: string;
  opacity?: number;
}

/** SVG gradient swirl for visual interest (static). */
export function DecorativeBlob({ color = "#FFFFFF", opacity = 0.1 }: DecorativeBlobProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      style={{
        position: "absolute",
        top: -80,
        right: -80,
        width: 360,
        height: 360,
        opacity,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id="blobGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M200,40 C280,60 340,140 320,220 C300,300 200,360 120,300 C40,240 60,120 140,60 C160,50 180,45 200,40 Z"
        fill="url(#blobGrad)"
      />
      <path
        d="M280,180 C320,200 340,260 300,300 C260,340 200,320 180,280 C160,240 220,160 280,180 Z"
        fill="url(#blobGrad)"
        opacity="0.7"
      />
    </svg>
  );
}

/** Darken or lighten a hex color by percent (-100 to 100). */
function shade(hex: string, percent: number): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const num = parseInt(n, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + Math.round(2.55 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(2.55 * percent)));
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(2.55 * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
