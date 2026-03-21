/**
 * Core canvas rendering for dendrochronology ring visualizations.
 *
 * Data-agnostic: works with any array of Ring objects.
 *
 * @typedef {Object} Ring
 * @property {number} width  - Relative radial thickness (will be normalized)
 * @property {number} texture - 0-1, controls jaggedness / noise complexity
 * @property {string} [label] - Display label (for tooltips)
 * @property {number} [seed]  - Optional deterministic seed; auto-generated if omitted
 * @property {Record<string, any>} [meta] - Arbitrary metadata
 */

import { ANGLE_STEPS, STEP, DEFAULT_OPTIONS } from "./defaults.js";
import { pseudoRand, ringNoise, smoothEdge } from "./noise.js";

/**
 * Draw dendrochronology rings onto a canvas 2D context.
 *
 * @param {CanvasRenderingContext2D} ctx - Already scaled for DPR/zoom
 * @param {Ring[]} rings - Array of ring data, inner to outer
 * @param {Partial<typeof DEFAULT_OPTIONS>} [opts]
 * @returns {{ zones: Array<{ innerRadius: number, outerRadius: number, ring: Ring, index: number }> }}
 */
export function drawDendroRings(ctx, rings, opts = {}) {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const palette = { ...DEFAULT_OPTIONS.palette, ...opts.palette };
  const size = o.size;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - o.padding;
  const coreRadius = o.coreRadius;

  // Normalize ring widths to fit available radius
  const maxTexture = Math.max(...rings.map((r) => r.texture), 0.01);
  const availableRadius = maxRadius - coreRadius;

  const rawWidths = rings.map((r) => {
    const wNorm = Math.max(r.width, 0.01) / Math.max(...rings.map((r2) => r2.width), 0.01);
    return o.minRingWidth + wNorm * (o.maxRingWidth - o.minRingWidth);
  });
  const totalRawWidth = rawWidths.reduce((s, w) => s + w, 0);
  const sc = totalRawWidth > availableRadius ? availableRadius / totalRawWidth : 1;
  const ringWidths = rawWidths.map((w) => w * sc);

  // Full-bleed paper (not clearRect) so PNG export and corners stay opaque with palette.background
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, size, size);

  const totalRingRadius = ringWidths.reduce((s, w) => s + w, 0);
  const treeRadius = Math.min(coreRadius + totalRingRadius + 6, maxRadius);

  // Base circle
  ctx.beginPath();
  ctx.arc(cx, cy, treeRadius, 0, Math.PI * 2);
  ctx.fillStyle = palette.background;
  ctx.fill();

  // Core (pith)
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
  ctx.fillStyle = palette.core;
  ctx.fill();
  ctx.strokeStyle = palette.coreBorder;
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Build initial previous edge
  let prevEdge = new Float32Array(ANGLE_STEPS);
  for (let j = 0; j < ANGLE_STEPS; j++) {
    prevEdge[j] = coreRadius;
  }

  const zones = [];

  rings.forEach((ring, i) => {
    const width = ringWidths[i];
    const seed = ring.seed != null ? ring.seed : (i * 7919 + 31);
    const textureNorm = ring.texture / maxTexture;

    // Noise parameters based on texture
    const lowFreq = 1.5 + pseudoRand(seed + 10) * 4;
    const highFreq = 10 + pseudoRand(seed + 20) * 12 + textureNorm * 15;
    const highFreqMix = 0.1 + textureNorm * 0.7;
    const wobbleAmount = 0.1 + textureNorm * 1.2;

    const ringChar = pseudoRand(seed + 50);
    const isWavy = ringChar > 0.85;
    const effectiveLowFreq = isWavy ? lowFreq * 2.5 : lowFreq;
    const effectiveWobble = isWavy ? wobbleAmount * 1.8 : wobbleAmount;

    // Compute outer edge from previous edge + growth
    const outerEdge = new Float32Array(ANGLE_STEPS);
    for (let j = 0; j < ANGLE_STEPS; j++) {
      const angle = j * STEP;
      const noiseVal = ringNoise(seed, angle, effectiveWobble, effectiveLowFreq, highFreq, highFreqMix);
      const growth = Math.max(width * 0.3, width + noiseVal);
      outerEdge[j] = prevEdge[j] + growth;
    }

    const smoothed = smoothEdge(outerEdge, 2);

    // Check bounds
    let clipped = false;
    for (let j = 0; j < ANGLE_STEPS; j++) {
      if (smoothed[j] > maxRadius) { clipped = true; break; }
    }
    if (clipped) return;

    // Hit zone radii
    let minR = Infinity, maxR = 0;
    for (let j = 0; j < ANGLE_STEPS; j++) {
      if (prevEdge[j] < minR) minR = prevEdge[j];
      if (smoothed[j] > maxR) maxR = smoothed[j];
    }

    // Ring styling
    const lineOpacity = 0.18 + textureNorm * 0.35 + pseudoRand(seed + 30) * 0.12;
    const lineWidth = 0.3 + textureNorm * 0.7 + pseudoRand(seed + 40) * 0.3;
    const strokeColor = palette.ringStroke.replace("{opacity}", lineOpacity.toFixed(3));

    // Primary outline
    ctx.beginPath();
    for (let j = 0; j <= ANGLE_STEPS; j++) {
      const idx = j % ANGLE_STEPS;
      const angle = idx * STEP;
      const r = smoothed[idx];
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Hand-drawn doubling
    if (width > 2.5 || textureNorm > 0.3) {
      ctx.beginPath();
      for (let j = 0; j <= ANGLE_STEPS; j++) {
        const idx = j % ANGLE_STEPS;
        const angle = idx * STEP;
        const offset = ringNoise(seed + 99, angle, 0.4, effectiveLowFreq * 1.3, highFreq * 0.7, 0.3);
        const r = smoothed[idx] - 0.5 + offset * 0.3;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = palette.ringStroke.replace("{opacity}", (lineOpacity * 0.25).toFixed(3));
      ctx.lineWidth = lineWidth * 0.4;
      ctx.stroke();
    }

    // Inner edge hint for wider rings
    if (width > 3.5) {
      ctx.beginPath();
      for (let j = 0; j <= ANGLE_STEPS; j++) {
        const idx = j % ANGLE_STEPS;
        const angle = idx * STEP;
        const r = prevEdge[idx];
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = palette.ringStroke.replace("{opacity}", (lineOpacity * 0.12).toFixed(3));
      ctx.lineWidth = lineWidth * 0.25;
      ctx.stroke();
    }

    // Knot (~8% of rings)
    if (pseudoRand(seed + 50) < 0.08) {
      const knotAngle = pseudoRand(seed + 100) * Math.PI * 2;
      const knotSpan = 0.25 + pseudoRand(seed + 101) * 0.35;
      const knotStart = Math.floor((knotAngle - knotSpan) / STEP);
      const knotEnd = Math.ceil((knotAngle + knotSpan) / STEP);
      ctx.beginPath();
      for (let j = knotStart; j <= knotEnd; j++) {
        const idx = ((j % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS;
        const angle = idx * STEP;
        const t = (angle - (knotAngle - knotSpan)) / (knotSpan * 2);
        const bulge = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * width * 1.2;
        const r = smoothed[idx] + bulge;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (j === knotStart) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = palette.ringStroke.replace("{opacity}", (lineOpacity * 0.5).toFixed(3));
      ctx.lineWidth = lineWidth * 0.7;
      ctx.stroke();
    }

    // Sparse arc dashes
    if (width > 2) {
      const dashCount = Math.floor(2 + textureNorm * 6 + pseudoRand(seed + 60) * 4);
      for (let j = 0; j < dashCount; j++) {
        const da = pseudoRand(seed + j * 17) * Math.PI * 2;
        const t = pseudoRand(seed + j * 23 + 1);
        const dIdx = Math.floor(da / STEP) % ANGLE_STEPS;
        const dr = prevEdge[dIdx] + t * (smoothed[dIdx] - prevEdge[dIdx]);
        const dlen = 0.015 + pseudoRand(seed + j * 31 + 2) * 0.05;
        ctx.beginPath();
        ctx.arc(cx, cy, dr, da, da + dlen);
        ctx.strokeStyle = palette.ringStroke.replace("{opacity}", (0.04 + pseudoRand(seed + j * 7) * 0.08).toFixed(3));
        ctx.lineWidth = 0.15 + pseudoRand(seed + j * 5) * 0.25;
        ctx.stroke();
      }
    }

    zones.push({ innerRadius: minR, outerRadius: maxR, midRadius: (minR + maxR) / 2, ring, index: i });

    prevEdge = new Float32Array(smoothed);
  });

  // Bark
  const lastR = prevEdge[0];
  if (lastR < maxRadius - 4) {
    ctx.beginPath();
    ctx.arc(cx, cy, lastR + 2, 0, Math.PI * 2);
    ctx.strokeStyle = palette.bark1;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, lastR + 4, 0, Math.PI * 2);
    ctx.strokeStyle = palette.bark2;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return { zones };
}
