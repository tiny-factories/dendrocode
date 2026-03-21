import React, { useMemo } from "react";
import { DendroChart } from "dendrochronology-visualizer/react";
import { githubPRsToRings } from "./lib/adapter.js";

/**
 * GitHub-specific tree ring visualization.
 * Wraps the generic DendroChart with PR-specific tooltip rendering.
 */
export default function TreeRing({
  pullRequests,
  username,
  repoName,
  size = 600,
  options = {},
  interactive = false,
}) {
  const rings = useMemo(() => githubPRsToRings(pullRequests), [pullRequests]);

  if (!pullRequests.length) {
    return <p style={{ color: "#998877" }}>No pull request data available.</p>;
  }

  return (
    <DendroChart
      rings={rings}
      size={size}
      options={options}
      interactive={interactive}
      renderTooltip={(ring, index, clientX, clientY) => {
        const pad = 8;
        const estW = 280;
        const estH = 120;
        const left = Math.min(
          Math.max(clientX + 12, pad),
          window.innerWidth - estW - pad,
        );
        const top = Math.min(
          Math.max(clientY - 60, pad),
          window.innerHeight - estH - pad,
        );
        return (
        <div
          style={{
            position: "fixed",
            left,
            top,
            background: "rgba(58, 48, 40, 0.94)",
            color: "#f5f0eb",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10000,
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
        );
      }}
    />
  );
}
