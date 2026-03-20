import React, { useRef, useEffect, memo } from "react";
import { drawDendroRings } from "../core/draw.js";

const EMPTY_OPTIONS = {};
const EMPTY_STYLE = {};

/**
 * Static dendrochronology ring thumbnail — no zoom, pan, or tooltip.
 * Optimized for gallery grids with React.memo.
 *
 * @param {Object} props
 * @param {Array<{ width: number, texture: number }>} props.rings
 * @param {number} [props.size=200]
 * @param {object} [props.options]
 * @param {object} [props.style]
 * @param {() => void} [props.onClick]
 * @param {number} [props.maxDpr] - Cap devicePixelRatio (e.g. 2 for dense grids)
 */
function DendroCard({ rings, size = 200, options = EMPTY_OPTIONS, style = EMPTY_STYLE, onClick, maxDpr }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rings.length) return;

    const raw = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const dpr = maxDpr != null ? Math.min(raw, maxDpr) : raw;
    const pxSize = Math.round(size * dpr);
    canvas.width = pxSize;
    canvas.height = pxSize;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    drawDendroRings(ctx, rings, { ...options, size });
  }, [rings, size, options, maxDpr]);

  if (!rings.length) return null;

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      style={{
        cursor: onClick ? "pointer" : "default",
        borderRadius: "50%",
        ...style,
      }}
    />
  );
}

export default memo(DendroCard);
