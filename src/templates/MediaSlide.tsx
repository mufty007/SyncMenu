import { QRCodeSVG } from "qrcode.react";
import type { MediaSlidePayload, Orientation } from "../lib/types";
import { boardDimensions } from "./shared";

interface MediaSlideProps {
  media: MediaSlidePayload;
  orientation: Orientation;
  priority?: boolean;
}

/** Full-screen media slide for playlist promo clips (GIF / video / image). */
export default function MediaSlide({ media, orientation, priority }: MediaSlideProps) {
  const { width, height } = boardDimensions(orientation);

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        background: "#000000",
      }}
    >
      {media.kind === "video" ? (
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={media.thumbnail_url ?? undefined}
          src={media.url}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <img
          src={media.url}
          alt={media.name}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}

      {media.name && (
        <div
          style={{
            position: "absolute",
            left: 48,
            bottom: 48,
            right: media.show_qr && media.link_url ? 200 : 48,
            fontFamily: '"Poppins", sans-serif',
            fontSize: 36,
            fontWeight: 600,
            color: "#FFFFFF",
            textShadow: "0 2px 16px rgba(0,0,0,0.6)",
          }}
        >
          {media.name}
        </div>
      )}

      {media.show_qr && media.link_url && (
        <div
          style={{
            position: "absolute",
            right: 40,
            bottom: 40,
            background: "#FFFFFF",
            borderRadius: 16,
            padding: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          }}
        >
          <QRCodeSVG value={media.link_url} size={120} />
        </div>
      )}
    </div>
  );
}
