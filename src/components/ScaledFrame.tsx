import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders fixed-resolution content (e.g. a 1920x1080 menu board) scaled to
 * fill the available width while preserving aspect ratio.
 */
export default function ScaledFrame({
  designWidth,
  designHeight,
  children,
  className = "",
}: {
  designWidth: number;
  designHeight: number;
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / designWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [designWidth]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{ height: scale * designHeight || undefined }}
    >
      {scale > 0 && (
        <div
          style={{
            width: designWidth,
            height: designHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
