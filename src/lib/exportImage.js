/**
 * High-resolution canvas export for print-quality images.
 */
import { drawDendroRings } from "dendrochronology-visualizer";

const DEFAULT_EXPORT_PIXELS = 4000;

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
  const size =
    typeof canvasSize === "number" && canvasSize > 0 ? Math.round(canvasSize) : DEFAULT_EXPORT_PIXELS;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  const paletteBg = drawOpts.palette && typeof drawOpts.palette.background === "string"
    ? drawOpts.palette.background
    : "#f5f0eb";
  ctx.fillStyle = paletteBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawDendroRings(ctx, rings, { ...drawOpts, size });
  drawCornerLabels(ctx, size, cornerTexts);

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
