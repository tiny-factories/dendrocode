/**
 * High-resolution canvas export for print-quality images.
 */
import { drawDendroRings } from "dendrochronology-visualizer";

const DEFAULT_EXPORT_PIXELS = 4000;

/** Draw options from `dendroDrawOptionsForPrint` are tuned for this logical size (matches on-screen TreeRing). */
const EXPORT_LOGICAL_PX = 600;

/**
 * @param {object} cornerTexts
 * @param {string} [cornerTexts.tl]
 * @param {string} [cornerTexts.tr]
 * @param {string} [cornerTexts.bl]
 * @param {string} [cornerTexts.br]
 */
function drawCornerLabels(ctx, size, cornerTexts) {
  const { tl = "", tr = "", bl = "", br = "" } = cornerTexts || {};
  if (!tl && !tr && !bl && !br) return;

  const m = Math.round(size * 0.02);
  const fontPx = Math.round(size * 0.0075);
  const line = Math.max(18, Math.min(34, fontPx));

  ctx.fillStyle = "#5c4d3f";
  ctx.font = `500 ${line}px Inter, -apple-system, sans-serif`;

  if (tl) {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(tl, m, m);
  }
  if (tr) {
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(tr, size - m, m);
  }
  if (bl) {
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(bl, m, size - m);
  }
  if (br) {
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(br, size - m, size - m);
  }
}

/**
 * @param {object} [cornerTexts] - optional labels placed near the four corners of the ring
 */
export async function exportHighResPNG(rings, opts = {}, cornerTexts = {}) {
  const { canvasSize, ...drawOpts } = opts;
  const outPx =
    typeof canvasSize === "number" && canvasSize > 0 ? Math.round(canvasSize) : DEFAULT_EXPORT_PIXELS;

  const canvas = document.createElement("canvas");
  canvas.width = outPx;
  canvas.height = outPx;

  const ctx = canvas.getContext("2d");
  const scale = outPx / EXPORT_LOGICAL_PX;

  // Scale up from print-tuned logical geometry so rings fill the output canvas (options assume ~600px space).
  ctx.save();
  ctx.scale(scale, scale);
  drawDendroRings(ctx, rings, { ...drawOpts, size: EXPORT_LOGICAL_PX });
  drawCornerLabels(ctx, EXPORT_LOGICAL_PX, cornerTexts);
  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

export async function downloadHighResPNG(rings, opts = {}, cornerTexts = {}, filename = "tree-ring") {
  const blob = await exportHighResPNG(rings, opts, cornerTexts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
