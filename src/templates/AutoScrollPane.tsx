import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const SCROLL_PX_PER_SEC = 42;
const MIN_CYCLE_SEC = 18;
const SCROLL_SHARE = 0.4;

type Anim = { distance: number; duration: number };

/**
 * Vertically scrolls overflowing menu content on signage displays.
 * Scrolls down, pauses, snaps back to top, and repeats.
 */
export default function AutoScrollPane({
  enabled = false,
  children,
  style,
}: {
  enabled?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState<Anim | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAnim(null);
      return;
    }

    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const overflow = inner.scrollHeight - outer.clientHeight;
      if (overflow > 12) {
        const scrollSec = overflow / SCROLL_PX_PER_SEC;
        const duration = Math.max(MIN_CYCLE_SEC, scrollSec / SCROLL_SHARE);
        setAnim({ distance: overflow, duration });
      } else {
        setAnim(null);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [enabled, children]);

  return (
    <div
      ref={outerRef}
      style={{
        overflow: "hidden",
        position: "relative",
        minHeight: 0,
        ...style,
      }}
    >
      <div
        ref={innerRef}
        style={
          anim
            ? ({
                ["--scroll-distance" as string]: `${anim.distance}px`,
                animation: `sm-board-scroll ${anim.duration}s linear infinite`,
                willChange: "transform",
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
