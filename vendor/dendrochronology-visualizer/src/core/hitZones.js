/**
 * Hit-testing utility for interactive dendrochronology charts.
 */

/**
 * Find which ring (if any) a point falls within.
 *
 * @param {Array<{ innerRadius: number, outerRadius: number, ring: object, index: number }>} zones
 * @param {number} distFromCenter - Euclidean distance from canvas center
 * @param {number} [tolerance=2] - Pixel tolerance for hit detection
 * @returns {{ ring: object, index: number } | null}
 */
export function hitTest(zones, distFromCenter, tolerance = 2) {
  const zone = zones.find(
    (z) => distFromCenter >= z.innerRadius - tolerance && distFromCenter <= z.outerRadius + tolerance
  );
  return zone ? { ring: zone.ring, index: zone.index } : null;
}

/**
 * Convert a mouse/touch position to distance from canvas center.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {DOMRect} canvasRect - from getBoundingClientRect()
 * @param {number} displaySize - logical canvas size (e.g. 600)
 * @returns {{ dist: number, mx: number, my: number }}
 */
export function clientToCanvasDistance(clientX, clientY, canvasRect, displaySize) {
  const scaleRatio = displaySize / canvasRect.width;
  const mx = (clientX - canvasRect.left) * scaleRatio - displaySize / 2;
  const my = (clientY - canvasRect.top) * scaleRatio - displaySize / 2;
  return { dist: Math.sqrt(mx * mx + my * my), mx, my };
}
