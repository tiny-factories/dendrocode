/**
 * High-resolution canvas export for print-quality images.
 */
import { drawDendroRings } from "dendrochronology-visualizer";

const PRINT_SIZE = 4000;

/**
 * @param {object} footer
 * @param {string} [footer.title] - Main label (e.g. display name)
 * @param {string} [footer.orgRepo] - e.g. owner / repo
 * @param {string} [footer.releaseTag] - e.g. v1.2.0
 */
export async function exportHighResPNG(rings, opts = {}, footer = {}) {
  const title = footer.title || "";
  const orgRepo = footer.orgRepo || "";
  const releaseTag = footer.releaseTag || "";
  const creditLines = [title, orgRepo, releaseTag].filter(Boolean);
  const hasCreditLines = creditLines.length > 0;

  let footerH = 0;
  if (hasCreditLines) {
    footerH = 52;
    if (title) footerH += 44;
    if (orgRepo) footerH += 40;
    if (releaseTag) footerH += 38;
    footerH += 36;
  }

  const canvas = document.createElement("canvas");
  const size = PRINT_SIZE;
  canvas.width = size;
  canvas.height = size + footerH;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f5f0eb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawDendroRings(ctx, rings, { ...opts, size });

  if (hasCreditLines) {
    ctx.textAlign = "center";
    let y = size + 48;
    if (title) {
      ctx.fillStyle = "#b0a090";
      ctx.font = "300 32px Inter, -apple-system, sans-serif";
      ctx.fillText(title, size / 2, y);
      y += 44;
    }
    if (orgRepo) {
      ctx.fillStyle = "#7a6a58";
      ctx.font = "500 24px Inter, -apple-system, sans-serif";
      ctx.fillText(orgRepo, size / 2, y);
      y += 40;
    }
    if (releaseTag) {
      ctx.fillStyle = "#6b5c4c";
      ctx.font = "500 22px Inter, -apple-system, sans-serif";
      const tagText = releaseTag.startsWith("v") || releaseTag.startsWith("V") ? releaseTag : `· ${releaseTag}`;
      ctx.fillText(tagText, size / 2, y);
      y += 38;
    }
    ctx.fillStyle = "#d4c8b8";
    ctx.font = "300 20px Inter, -apple-system, sans-serif";
    ctx.fillText(`${rings.length} contributions · dendrochronology`, size / 2, y);
  }

  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

export async function downloadHighResPNG(rings, opts = {}, footer = {}, filename = "tree-ring") {
  const blob = await exportHighResPNG(rings, opts, footer);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
