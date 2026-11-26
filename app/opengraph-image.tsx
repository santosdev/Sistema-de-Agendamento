import { ImageResponse } from "next/og";
import { LOGO_R_PATH, LOGO_R_VIEWBOX } from "@/components/brand/logo-r-path";
import { getMessages } from "@/lib/i18n";

const t = getMessages().meta;

export const alt = t.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview for WhatsApp, LinkedIn and others. Built once at build time (no request data). */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "linear-gradient(135deg, #0c003c 0%, #2a0a8a 55%, #5b02fd 85%, #d94eff 120%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width={98} height={80} viewBox={LOGO_R_VIEWBOX} fill="#ffffff">
          <path d={LOGO_R_PATH} />
        </svg>
        <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -0.5 }}>Tech Resolute</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <span style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>{t.title}</span>
        <span style={{ fontSize: 36, color: "#d9ccf7", lineHeight: 1.3, maxWidth: 1040 }}>{t.ogTagline}</span>
      </div>
    </div>,
    size,
  );
}
