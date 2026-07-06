interface LogoProps {
  /** "color" for light backgrounds, "white" for dark/orange backgrounds */
  variant?: "color" | "white";
  size?: number;
  withWordmark?: boolean;
}

export function SyncIcon({
  size = 28,
  color = "#FF6B2C",
  mark = "white",
}: {
  size?: number;
  color?: string;
  mark?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="14" fill={color} />
      <path
        d="M20 26a13 13 0 0 1 22-5"
        stroke={mark}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M44 38a13 13 0 0 1-22 5"
        stroke={mark}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M42 13v9h-9"
        stroke={mark}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 51v-9h9"
        stroke={mark}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({
  variant = "color",
  size = 28,
  withWordmark = true,
}: LogoProps) {
  const white = variant === "white";
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <SyncIcon
        size={size}
        color={white ? "rgba(255,255,255,0.16)" : "#FF6B2C"}
        mark={white ? "#FFFFFF" : "white"}
      />
      {withWordmark && (
        <span
          className="font-display font-bold tracking-tight"
          style={{ fontSize: size * 0.78 }}
        >
          <span className={white ? "text-white" : "text-brand"}>Sync</span>
          <span className={white ? "text-white" : "text-ink"}>Menu</span>
        </span>
      )}
    </span>
  );
}
