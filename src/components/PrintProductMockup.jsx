import React, { useLayoutEffect, useRef } from "react";

/**
 * Print preview: square sheet with optional paper texture. Backdrop "clean" (default) or "gallery" wall.
 * Reports actual face width via onFaceWidth so the ring canvas can match and avoid overflow.
 *
 * @param {{
 *   variant?: "modal" | "embedded",
 *   backdrop?: "clean" | "gallery",
 *   printSize: { label: string, inches: number },
 *   printPaper: { id: string, label: string },
 *   facePx: number,
 *   showCaption?: boolean,
 *   onFaceWidth?: (widthPx: number) => void,
 *   children: React.ReactNode,
 * }} props
 */
export default function PrintProductMockup({
  variant = "modal",
  backdrop = "clean",
  printSize,
  printPaper,
  facePx,
  showCaption = true,
  onFaceWidth,
  children,
}) {
  const warm = printPaper.id === "hahnemuhle";
  const faceRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const wallStyle = pickWallStyle(variant, backdrop);

  useLayoutEffect(() => {
    const el = faceRef.current;
    if (!el || !onFaceWidth) return undefined;

    const report = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) onFaceWidth(w);
    };

    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onFaceWidth, facePx, backdrop, variant]);

  return (
    <div style={wallStyle}>
      <div style={styles.column}>
        <div
          ref={faceRef}
          role="img"
          aria-label={`Print preview, ${printSize.label}, ${printPaper.label}`}
          style={{
            ...styles.face,
            width: `min(100%, ${facePx}px)`,
            maxWidth: "100%",
            aspectRatio: "1 / 1",
            height: "auto",
            boxShadow: warm ? styles.faceShadowWarm : styles.faceShadowMatte,
          }}
        >
          <div
            aria-hidden
            style={{
              ...styles.paperBase,
              background: warm
                ? "linear-gradient(145deg, rgba(255, 248, 238, 0.5) 0%, rgba(241, 228, 212, 0.35) 100%)"
                : "linear-gradient(160deg, rgba(252, 252, 250, 0.45) 0%, rgba(235, 232, 227, 0.3) 100%)",
            }}
          />
          <div aria-hidden style={{ ...styles.grain, opacity: warm ? 0.11 : 0.07 }} />
          <div aria-hidden style={styles.edgeSheen} />
          <div style={styles.faceInner}>{children}</div>
        </div>
        {showCaption ? (
          <p style={styles.caption}>
            <span style={styles.captionStrong}>Approximate preview</span>
            {" · "}
            {printSize.label} square · {paperCaption(printPaper)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function pickWallStyle(variant, backdrop) {
  if (backdrop === "gallery") {
    return variant === "modal" ? styles.wallModal : styles.wallEmbedded;
  }
  return variant === "modal" ? styles.wallCleanModal : styles.wallCleanEmbedded;
}

function paperCaption(p) {
  if (p.id === "matte") return "Enhanced matte finish";
  if (p.id === "hahnemuhle") return "Hahnemühle etching (warmer, textured)";
  return p.label;
}

const styles = {
  wallModal: {
    background: "linear-gradient(180deg, #c9c4bc 0%, #b0aba4 48%, #9c9892 100%)",
    borderRadius: 14,
    padding: "22px 20px 18px",
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 1px 3px rgba(0,0,0,0.06)",
    width: "100%",
    minWidth: 0,
  },
  wallEmbedded: {
    background: "linear-gradient(165deg, #d4d0c9 0%, #c3beb6 55%, #b5afa7 100%)",
    borderRadius: 0,
    padding: "12px 14px 10px",
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
    width: "100%",
    minWidth: 0,
  },
  wallCleanModal: {
    background: "transparent",
    borderRadius: 0,
    padding: "4px 0 12px",
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
  },
  wallCleanEmbedded: {
    background: "transparent",
    borderRadius: 0,
    padding: "0 0 10px",
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
  },
  column: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minWidth: 0,
  },
  face: {
    position: "relative",
    borderRadius: 2,
    border: "1px solid rgba(45, 40, 34, 0.12)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  faceShadowMatte: "0 18px 36px rgba(20, 18, 14, 0.18), 0 6px 12px rgba(20, 18, 14, 0.1), 0 1px 0 rgba(255,255,255,0.55) inset",
  faceShadowWarm: "0 20px 38px rgba(28, 20, 14, 0.2), 0 7px 14px rgba(28, 20, 14, 0.11), 0 1px 0 rgba(255,252,248,0.5) inset",
  paperBase: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 1,
    mixBlendMode: "multiply",
  },
  grain: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 2,
    mixBlendMode: "multiply",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)'/%3E%3C/svg%3E")`,
    backgroundSize: "180px 180px",
  },
  edgeSheen: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 2,
    boxShadow: "inset 0 0 28px rgba(255,255,255,0.12)",
    borderRadius: 1,
  },
  faceInner: {
    position: "absolute",
    inset: 0,
    zIndex: 3,
    overflow: "hidden",
  },
  caption: {
    margin: 0,
    fontSize: 11,
    lineHeight: 1.45,
    color: "rgba(40, 38, 34, 0.82)",
    textAlign: "center",
    maxWidth: "min(100%, 320px)",
    fontWeight: 400,
  },
  captionStrong: {
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    fontSize: 10,
    color: "rgba(35, 33, 30, 0.88)",
  },
};
