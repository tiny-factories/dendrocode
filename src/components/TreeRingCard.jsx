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

export default function TreeRingCard({ entry, onClick }) {
  const rings = useMemo(() => githubPRsToRings(entry.pullRequests), [entry.pullRequests]);
  const [hovered, setHovered] = useState(false);
  const label = formatEntryLabel(entry.displayName);

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
