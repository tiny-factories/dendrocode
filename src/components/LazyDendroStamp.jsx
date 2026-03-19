import React, { useState, useEffect, useRef } from "react";
import { DendroCard } from "dendrochronology-visualizer/react";
import { observeWhenNearViewport } from "../lib/lazyStampObserver.js";

/**
 * Mounts DendroCard only when near the viewport — avoids hundreds of simultaneous canvas draws.
 * Uses one shared IntersectionObserver for all stamps.
 */
export default function LazyDendroStamp({ rings, size, maxDpr = 2 }) {
  const wrapRef = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || show) return;
    return observeWhenNearViewport(el, () => setShow(true));
  }, [show]);

  return (
    <div
      ref={wrapRef}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        overflow: "hidden",
      }}
    >
      {show ? (
        <DendroCard rings={rings} size={size} maxDpr={maxDpr} />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: "linear-gradient(145deg, rgba(232, 224, 214, 0.9), rgba(200, 188, 172, 0.45))",
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
