import React, { useMemo } from "react";
import { DendroChart } from "dendrochronology-visualizer/react";
import { githubPRsToRings } from "./lib/adapter.js";

/**
 * GitHub-specific tree ring visualization.
 * Wraps the generic DendroChart with PR-specific tooltip rendering.
 */
export default function TreeRing({ pullRequests, username, repoName, size = 600 }) {
  const rings = useMemo(() => githubPRsToRings(pullRequests), [pullRequests]);

  if (!pullRequests.length) {
    return <p style={{ color: "#998877" }}>No pull request data available.</p>;
  }

  return (
    <DendroChart
      rings={rings}
      size={size}
      interactive={false}
      renderTooltip={(ring, index, x, y) => (
        <div
          style={{
            position: "absolute",
            left: Math.min(Math.max(x + 12, 8), window.innerWidth - 320),
            top: Math.max(y - 60, 8),
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
          }}
        >
          <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ring.label}
          </div>
          <div style={{ fontWeight: 300 }}>{ring.meta.merged}</div>
          <div style={{ fontWeight: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ring.meta.details}
          </div>
        </div>
      )}
    />
  );
}
