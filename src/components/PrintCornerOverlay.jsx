import React from "react";
import { PRINT_CORNER_SLOT_IDS } from "../lib/printCorners.js";

const cornerLayouts = {
  tl: { top: 6, left: 8, right: undefined, bottom: undefined, alignItems: "flex-start" },
  tr: { top: 6, right: 8, left: undefined, bottom: undefined, alignItems: "flex-end" },
  bl: { bottom: 8, left: 8, right: undefined, top: undefined, alignItems: "flex-start" },
  br: { bottom: 8, right: 8, left: undefined, top: undefined, alignItems: "flex-end" },
};

const textBlockStyle = {
  position: "absolute",
  zIndex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  fontSize: 11,
  fontWeight: 500,
  color: "#5c4d3f",
  lineHeight: 1.25,
  wordBreak: "break-word",
  maxWidth: "min(46%, 200px)",
  pointerEvents: "none",
};

/**
 * Renders resolved corner label text on the print face (read-only on canvas).
 * Editing is done via {@link import("./PrintCornerEditorBar.jsx")} below the preview.
 *
 * @param {{
 *   mode?: 'edit' | 'read',
 *   slots?: Record<string, string>,
 *   cornerTexts: Record<string, string>,
 *   releaseFetchState?: string,
 * }} props
 */
export default function PrintCornerOverlay({
  slots = {},
  cornerTexts,
  releaseFetchState = "idle",
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {PRINT_CORNER_SLOT_IDS.map((id) => {
        const pos = cornerLayouts[id];
        const text = (cornerTexts[id] || "").trim();
        const slot = slots[id] || "none";
        const showReleaseWait = slot === "releaseTag" && releaseFetchState === "loading";
        const display = showReleaseWait ? "Loading release…" : text;
        if (!display) return null;

        return (
          <div
            key={id}
            style={{
              ...textBlockStyle,
              ...pos,
              textAlign: id === "tr" || id === "br" ? "right" : "left",
              alignItems: pos.alignItems,
            }}
            title={display}
          >
            {display}
          </div>
        );
      })}
    </div>
  );
}
