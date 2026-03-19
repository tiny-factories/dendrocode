import React, { useMemo, useState } from "react";
import { DendroCard } from "dendrochronology-visualizer/react";
import { githubPRsToRings } from "../lib/adapter.js";

/**
 * Gallery thumbnail card showing a tree ring + label.
 */
function formatEntryLabel(displayName) {
  const dn = (displayName || "").trim();
  const slash = dn.indexOf("/");
  return slash >= 0
    ? `@${dn.slice(0, slash)} / ${dn.slice(slash + 1)}`
    : `@${dn}`;
}

export default function TreeRingCard({ entry, onClick, variant = "full" }) {
  const rings = useMemo(() => githubPRsToRings(entry.pullRequests), [entry.pullRequests]);
  const [hovered, setHovered] = useState(false);
  const label = formatEntryLabel(entry.displayName);
  const nameOnly = (entry.displayName || "").trim();

  if (variant === "name") {
    return (
      <button
        type="button"
        style={{
          ...styles.nameTile,
          ...(hovered ? styles.nameTileHover : {}),
        }}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {nameOnly}
      </button>
    );
  }

  return (
    <div
      style={{
        ...styles.card,
        ...(hovered ? styles.cardHover : {}),
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        ...styles.canvasWrap,
        transform: hovered ? "scale(1.03)" : "scale(1)",
        transition: "transform 0.3s ease",
      }}>
        <DendroCard rings={rings} size={150} />
      </div>
      <div style={styles.metaRow}>
        <div style={styles.label}>{label}</div>
      </div>
    </div>
  );
}

const styles = {
  nameTile: {
    display: "block",
    width: "100%",
    margin: 0,
    padding: "10px 4px",
    textAlign: "left",
    border: "none",
    borderBottom: "1px solid transparent",
    background: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 400,
    color: "#3a3028",
    lineHeight: 1.45,
    wordBreak: "break-word",
    transition: "color 0.15s ease, border-color 0.15s ease",
  },
  nameTileHover: {
    color: "#2d6a4f",
    borderBottomColor: "rgba(45, 106, 79, 0.35)",
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    width: "100%",
    cursor: "pointer",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e3d8cc",
    transition: "background 0.2s, border-color 0.2s, transform 0.2s",
    background: "rgba(255, 255, 255, 0.68)",
    boxShadow: "0 1px 3px rgba(58, 48, 40, 0.05)",
  },
  cardHover: {
    background: "rgba(255, 255, 255, 0.88)",
    borderColor: "#d0c2b3",
    transform: "translateY(-2px)",
  },
  canvasWrap: {
    width: 150,
    height: 150,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  metaRow: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    minWidth: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: 500,
    color: "#6a5a48",
    lineHeight: 1.35,
    wordBreak: "break-word",
  },
};
