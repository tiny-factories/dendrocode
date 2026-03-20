import React, { useMemo, useState, useCallback } from "react";
import LazyDendroStamp from "./LazyDendroStamp.jsx";
import { githubPRsToRings } from "../lib/adapter.js";

/**
 * Landing-style ring stamp: circular canvas + repo name on hover only.
 */
export default function GalleryBrowseStamp({ entry, onSelect, size = 96 }) {
  const rings = useMemo(() => githubPRsToRings(entry.pullRequests), [entry.pullRequests]);
  const [hovered, setHovered] = useState(false);
  const repoName = (entry.displayName || "").trim() || "Untitled";

  const onActivate = useCallback(() => {
    onSelect(entry);
  }, [entry, onSelect]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
    [onActivate],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${repoName}`}
      style={{
        ...styles.stampCard,
        ...(hovered ? styles.stampCardHover : null),
        cursor: "pointer",
      }}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <LazyDendroStamp rings={rings} size={size} maxDpr={2} />
      <div
        style={{ ...styles.hoverText, ...(hovered ? styles.hoverTextVisible : null) }}
        aria-hidden
      >
        <div style={styles.hoverName}>{repoName}</div>
      </div>
    </div>
  );
}

const styles = {
  stampCard: {
    position: "relative",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    padding: 0,
    transition: "transform 0.2s ease",
    outline: "none",
  },
  stampCardHover: {
    transform: "translateY(-2px) scale(1.03)",
    zIndex: 3,
  },
  hoverText: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    top: "100%",
    marginTop: 8,
    width: "max-content",
    maxWidth: 220,
    opacity: 0,
    pointerEvents: "none",
    transition: "opacity 0.15s ease",
    textAlign: "center",
    boxSizing: "border-box",
  },
  hoverTextVisible: {
    opacity: 1,
  },
  hoverName: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    color: "#3a3028",
    lineHeight: 1.25,
    wordBreak: "break-word",
    textShadow: "0 0 10px #f5f0eb, 0 0 6px #f5f0eb, 0 1px 0 #f5f0eb",
  },
};
