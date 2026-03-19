/**
 * High-resolution canvas export for print-quality images.
 * Re-renders the tree ring at a much larger size (4000px) for 300 DPI printing.
 */
import { drawDendroRings } from "dendrochronology-visualizer";

const PRINT_SIZE = 4000; // 4000px = ~13.3" at 300 DPI

/**
 * Render tree rings at print resolution and return as a PNG Blob.
 * @param {Array} rings - Ring data (same format as DendroChart)
 * @param {object} [opts] - Options for drawDendroRings
 * @param {string} [label] - Optional label to render below the rings
 * @returns {Promise<Blob>}
 */
export async function exportHighResPNG(rings, opts = {}, label = "") {
  const canvas = document.createElement("canvas");
  const size = PRINT_SIZE;
  canvas.width = size;
  canvas.height = label ? size + 120 : size;

  const ctx = canvas.getContext("2d");

  // White background
  ctx.fillStyle = "#f5f0eb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw rings at full resolution
  drawDendroRings(ctx, rings, { ...opts, size });

  // Optional label at bottom
  if (label) {
    ctx.fillStyle = "#b0a090";
    ctx.font = "300 32px Inter, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, size / 2, size + 60);

    ctx.fillStyle = "#d4c8b8";
    ctx.font = "300 20px Inter, -apple-system, sans-serif";
    ctx.fillText(`${rings.length} contributions · dendrochronology`, size / 2, size + 95);
  }

  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

/**
 * Trigger a browser download of the high-res PNG.
 */
export async function downloadHighResPNG(rings, opts = {}, label = "", filename = "tree-ring") {
  const blob = await exportHighResPNG(rings, opts, label);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
