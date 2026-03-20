import React, { useRef, useEffect, useState, useCallback } from "react";
import { drawDendroRings } from "../core/draw.js";
import { hitTest, clientToCanvasDistance } from "../core/hitZones.js";

const DEFAULT_SIZE = 600;

/**
 * Interactive dendrochronology ring chart with zoom, pan, and tooltip.
 *
 * @param {Object} props
 * @param {Array<{ width: number, texture: number, label?: string, seed?: number, meta?: Record<string, any> }>} props.rings
 * @param {number} [props.size=600]
 * @param {boolean} [props.interactive=true]
 * @param {(ring: object, index: number) => void} [props.onRingHover]
 * @param {(ring: object, index: number) => void} [props.onRingClick]
 * @param {(ring: object) => React.ReactNode} [props.renderTooltip] - Custom tooltip renderer
 * @param {object} [props.options] - Options passed to drawDendroRings
 * @param {object} [props.style] - Style for the wrapper div
 */
export default function DendroChart({
  rings,
  size = DEFAULT_SIZE,
  interactive = true,
  onRingHover,
  onRingClick,
  renderTooltip,
  options = {},
  style = {},
}) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const zonesRef = useRef([]);
  const [tooltip, setTooltip] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastTouchDist = useRef(null);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rings.length) return;

    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const renderScale = Math.min(zoom, 5) * dpr;
    const pxSize = Math.round(size * renderScale);
    canvas.width = pxSize;
    canvas.height = pxSize;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(renderScale, renderScale);

    const { zones } = drawDendroRings(ctx, rings, { ...options, size });
    zonesRef.current = zones;
  }, [rings, zoom, size, options]);

  // Wheel zoom
  useEffect(() => {
    if (!interactive) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.95 : 1.05;
      setZoom((z) => Math.min(Math.max(z * factor, 0.5), 6));
    };
    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, [interactive]);

  // Touch pinch zoom
  useEffect(() => {
    if (!interactive) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastTouchDist.current !== null) {
          const s = dist / lastTouchDist.current;
          setZoom((z) => Math.min(Math.max(z * s, 0.5), 6));
        }
        lastTouchDist.current = dist;
      }
    };
    const onTouchEnd = () => { lastTouchDist.current = null; };
    wrapper.addEventListener("touchmove", onTouchMove, { passive: false });
    wrapper.addEventListener("touchend", onTouchEnd);
    return () => {
      wrapper.removeEventListener("touchmove", onTouchMove);
      wrapper.removeEventListener("touchend", onTouchEnd);
    };
  }, [interactive]);

  const onMouseDown = useCallback((e) => {
    if (!interactive || zoom <= 1) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, [interactive, zoom]);

  const onMouseMoveHandler = useCallback((e) => {
    if (!interactive) return;

    if (dragging.current && zoom > 1) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setTooltip(null);
      return;
    }

    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const { dist } = clientToCanvasDistance(e.clientX, e.clientY, canvasRect, size);

    const hit = hitTest(zonesRef.current, dist);
    if (hit) {
      onRingHover?.(hit.ring, hit.index);
      setTooltip({
        x: e.clientX - wrapperRect.left,
        y: e.clientY - wrapperRect.top,
        ring: hit.ring,
        index: hit.index,
      });
    } else {
      setTooltip(null);
    }
  }, [interactive, zoom, size, onRingHover]);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  const onClickHandler = useCallback((e) => {
    if (!interactive || !onRingClick) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const { dist } = clientToCanvasDistance(e.clientX, e.clientY, canvasRect, size);
    const hit = hitTest(zonesRef.current, dist);
    if (hit) onRingClick(hit.ring, hit.index);
  }, [interactive, onRingClick, size]);

  const onDoubleClick = useCallback(() => {
    if (!interactive) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [interactive]);

  if (!rings.length) return null;

  const defaultTooltipContent = tooltip && !renderTooltip ? (
    <div style={{
      position: "absolute",
      left: Math.min(Math.max(tooltip.x + 12, 8), typeof window !== "undefined" ? window.innerWidth - 320 : 500),
      top: Math.max(tooltip.y - 60, 8),
      background: "rgba(58, 48, 40, 0.94)",
      color: "#f5f0eb",
      padding: "10px 14px",
      borderRadius: 8,
      fontSize: 12,
      pointerEvents: "none",
      whiteSpace: "nowrap",
      zIndex: 10,
      border: "1px solid rgba(138, 106, 72, 0.4)",
      lineHeight: 1.6,
      maxWidth: 280,
      overflow: "hidden",
      textOverflow: "ellipsis",
    }}>
      {tooltip.ring.label && (
        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tooltip.ring.label}
        </div>
      )}
      {tooltip.ring.meta && Object.entries(tooltip.ring.meta).map(([k, v]) => (
        <div key={k} style={{ fontWeight: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {k}: {v}
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        cursor: interactive ? (zoom > 1 ? (dragging.current ? "grabbing" : "grab") : "crosshair") : "default",
        ...style,
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMoveHandler}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { setTooltip(null); dragging.current = false; }}
      onClick={onClickHandler}
      onDoubleClick={onDoubleClick}
    >
      <canvas
        ref={canvasRef}
        style={{
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transformOrigin: "center center",
          transition: dragging.current ? "none" : "transform 0.1s ease-out",
          maxWidth: "90vmin",
          maxHeight: "90vmin",
          imageRendering: "auto",
        }}
      />
      {tooltip && renderTooltip ? renderTooltip(tooltip.ring, tooltip.index, tooltip.x, tooltip.y) : defaultTooltipContent}
      {interactive && zoom > 1 && (
        <div style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          fontSize: 11,
          color: "#998877",
          background: "rgba(245, 240, 235, 0.8)",
          padding: "4px 10px",
          borderRadius: 4,
        }}>
          {Math.round(zoom * 100)}% · double-click to reset
        </div>
      )}
    </div>
  );
}
