import React from "react";

/**
 * Fine-art print “true preview”: neutral wall, square sheet at relative size, paper finish overlay, caption.
 *
 * @param {{
 *   variant?: "modal" | "embedded",
 *   printSize: { label: string, inches: number },
 *   printPaper: { id: string, label: string },
 *   facePx: number,
 *   showCaption?: boolean,
 *   children: React.ReactNode,
 * }} props
 */
export default function PrintProductMockup({
  variant = "modal",
  printSize,
  printPaper,
  facePx,
  showCaption = true,
  children,
}) {
  const warm = printPaper.id === "hahnemuhle";
  const wallStyle = variant === "modal" ? styles.wallModal : styles.wallEmbedded;

  return (
    <div style={wallStyle}>
      <div style={styles.column}>
        <div
          role="img"
          aria-label={`Print preview, ${printSize.label}, ${printPaper.label}`}
          style={{
            ...styles.face,
            width: facePx,
            height: facePx,
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
  },
  wallEmbedded: {
    background: "linear-gradient(165deg, #d4d0c9 0%, #c3beb6 55%, #b5afa7 100%)",
    borderRadius: 0,
    padding: "12px 14px 10px",
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  face: {
    position: "relative",
    borderRadius: 2,
    border: "1px solid rgba(45, 40, 34, 0.12)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  faceShadowMatte: "0 22px 40px rgba(20, 18, 14, 0.28), 0 8px 16px rgba(20, 18, 14, 0.14), 0 1px 0 rgba(255,255,255,0.5) inset",
  faceShadowWarm: "0 24px 44px rgba(28, 20, 14, 0.32), 0 9px 18px rgba(28, 20, 14, 0.16), 0 1px 0 rgba(255,252,248,0.45) inset",
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
    position: "relative",
    zIndex: 3,
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  caption: {
    margin: 0,
    fontSize: 11,
    lineHeight: 1.45,
    color: "rgba(40, 38, 34, 0.82)",
    textAlign: "center",
    maxWidth: 320,
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
