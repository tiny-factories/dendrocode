/**
 * Fine-art print SKUs, pricing, and mapping into preview / export / dendro draw options.
 */

export const PRINT_SIZES = [
  { id: "12x12", label: '12×12"', sku: "GLOBAL-FAP-12x12", price: 49, inches: 12 },
  { id: "16x16", label: '16×16"', sku: "GLOBAL-FAP-16x16", price: 79, inches: 16 },
  { id: "24x24", label: '24×24"', sku: "GLOBAL-FAP-24x24", price: 129, inches: 24 },
];

export const PRINT_PAPERS = [
  { id: "matte", label: "Enhanced Matte", surcharge: 0 },
  { id: "hahnemuhle", label: "Hahnemühle German Etching", surcharge: 30 },
];

const BASELINE_INCHES = 16;

/**
 * Canvas pixel size for PNG upload (~280–320 PPI across sizes).
 * @param {{ inches: number }} printSize
 */
export function exportCanvasPixelsForPrintSize(printSize) {
  const inches = printSize.inches;
  return Math.round(2600 + inches * 185);
}

/**
 * @param {{ inches: number }} printSize
 * @param {{ id: string }} paper
 */
export function dendroDrawOptionsForPrint(printSize, paper) {
  const inches = printSize.inches;
  const scale = inches / BASELINE_INCHES;
  const warm = String(paper.id) === "hahnemuhle";

  return {
    minRingWidth: 1.35 + (1 - scale) * 0.35,
    maxRingWidth: 9 + scale * 5,
    coreRadius: Math.round(6 + scale * 5),
    padding: Math.round(14 + scale * 7),
    palette: warm
      ? {
          background: "#f4ede5",
          core: "#cfc3b4",
          coreBorder: "rgba(88, 58, 32, 0.44)",
          ringStroke: "rgba(68, 44, 20, {opacity})",
          bark1: "rgba(95, 68, 38, 0.33)",
          bark2: "rgba(78, 54, 28, 0.2)",
        }
      : {
          background: "#efe8e0",
          core: "#d6cbc0",
          coreBorder: "rgba(100, 70, 40, 0.4)",
          ringStroke: "rgba(82, 54, 26, {opacity})",
          bark1: "rgba(108, 78, 46, 0.29)",
          bark2: "rgba(88, 62, 32, 0.17)",
        },
  };
}

/**
 * On-screen preview frame: scales with chosen print size (16″ = 1×).
 * @param {number} baseSheetPx - responsive baseline at 16×16
 * @param {{ inches: number }} printSize
 */
export function previewSheetPxForPrint(baseSheetPx, printSize) {
  const scale = printSize.inches / BASELINE_INCHES;
  return Math.max(220, Math.min(600, Math.round(baseSheetPx * scale)));
}

/** Square print “face” in the order modal: 12″ smallest, 24″ largest (relative scale). */
export function modalPrintFacePx(printSize) {
  const t = (printSize.inches - 12) / 12;
  return Math.round(200 + Math.max(0, Math.min(1, t)) * 92);
}

export function modalRingDrawPx(facePx) {
  return Math.max(140, Math.round(facePx * 0.74));
}
