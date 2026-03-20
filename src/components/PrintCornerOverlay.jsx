import React, { useEffect, useRef, useState } from "react";
import { PRINT_CORNER_OPTIONS, PRINT_CORNER_SLOT_IDS } from "../lib/printCorners.js";

const cornerLayouts = {
  tl: { top: 6, left: 8, right: undefined, bottom: undefined, alignItems: "flex-start" },
  tr: { top: 6, right: 8, left: undefined, bottom: undefined, alignItems: "flex-end" },
  bl: { bottom: 8, left: 8, right: undefined, top: undefined, alignItems: "flex-start" },
  br: { bottom: 8, right: 8, left: undefined, top: undefined, alignItems: "flex-end" },
};

function cornerPosLabel(id) {
  if (id === "tl") return "top left";
  if (id === "tr") return "top right";
  if (id === "bl") return "bottom left";
  return "bottom right";
}

const selectStyle = {
  fontSize: 10,
  fontWeight: 500,
  padding: "3px 5px",
  borderRadius: 4,
  border: "1px solid #d4c8b8",
  background: "rgba(255, 252, 248, 0.94)",
  color: "#4a3f35",
  cursor: "pointer",
  fontFamily: "inherit",
  maxWidth: "100%",
  boxSizing: "border-box",
};

/**
 * @param {{
 *   id: string,
 *   pos: typeof cornerLayouts.tl,
 *   slot: string,
 *   text: string,
 *   showReleaseWait: boolean,
 *   active: boolean,
 *   onActivate: () => void,
 *   onDeactivateIfInactive: () => void,
 *   rootRef: (el: HTMLDivElement | null) => void,
 *   onSlotChange: (id: string, value: string) => void,
 * }} props
 */
function PrintCornerEditCell({
  id,
  pos,
  slot,
  text,
  showReleaseWait,
  active,
  onActivate,
  onDeactivateIfInactive,
  rootRef,
  onSlotChange,
}) {
  const selectRef = useRef(/** @type {HTMLSelectElement | null} */ (null));

  useEffect(() => {
    if (active && selectRef.current) {
      selectRef.current.focus();
    }
  }, [active]);

  const restLineStyle = {
    fontSize: 11,
    fontWeight: 500,
    color: showReleaseWait ? "#a89a8a" : "#5c4d3f",
    lineHeight: 1.25,
    textAlign: id === "tr" || id === "br" ? "right" : "left",
    wordBreak: "break-word",
    maxWidth: "100%",
  };

  const posL = cornerPosLabel(id);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivateIfInactive}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onActivate();
      }}
      onBlurCapture={(e) => {
        const rt = e.relatedTarget;
        if (rt instanceof Node && e.currentTarget.contains(rt)) return;
        onDeactivateIfInactive();
      }}
      onClick={() => {
        if (!active) onActivate();
      }}
      title={active ? undefined : "Hover, tap, or Tab to change this label"}
      style={{
        position: "absolute",
        ...pos,
        zIndex: 3,
        display: "flex",
        flexDirection: "column",
        alignItems: pos.alignItems,
        gap: 0,
        maxWidth: "min(46%, 168px)",
        pointerEvents: "auto",
        outline: "none",
      }}
    >
      {active ? (
        <select
          ref={selectRef}
          value={slot}
          onChange={(e) => onSlotChange(id, e.target.value)}
          onBlur={onDeactivateIfInactive}
          aria-label={`Print label, ${posL}`}
          style={selectStyle}
        >
          {PRINT_CORNER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : null}
      {!active && slot !== "none" ? (
        <div style={restLineStyle} title={text || undefined}>
          {showReleaseWait ? "Loading release…" : text || "—"}
        </div>
      ) : null}
      {!active && slot === "none" ? (
        <span
          style={{
            display: "inline-block",
            minWidth: 40,
            minHeight: 30,
          }}
          aria-label={`Print label ${posL}, empty`}
        />
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   mode: 'edit' | 'read',
 *   slots?: Record<string, string>,
 *   onSlotChange?: (id: string, value: string) => void,
 *   cornerTexts: Record<string, string>,
 *   releaseFetchState?: string,
 * }} props
 */
export default function PrintCornerOverlay({
  mode,
  slots = {},
  onSlotChange,
  cornerTexts,
  releaseFetchState = "idle",
}) {
  const [activeCornerId, setActiveCornerId] = useState(/** @type {string | null} */ (null));
  const cornerRootRefs = useRef(/** @type {Record<string, HTMLDivElement | null>} */ ({}));

  const tryDeactivate = (id) => {
    requestAnimationFrame(() => {
      const el = cornerRootRefs.current[id];
      if (el && !el.contains(document.activeElement)) {
        setActiveCornerId((cur) => (cur === id ? null : cur));
      }
    });
  };

  return (
    <>
      {PRINT_CORNER_SLOT_IDS.map((id) => {
        const pos = cornerLayouts[id];
        const text = (cornerTexts[id] || "").trim();
        const slot = slots[id] || "none";
        const showReleaseWait = mode === "edit" && slot === "releaseTag" && releaseFetchState === "loading";

        if (mode === "read") {
          if (!text) return null;
          return (
            <div
              key={id}
              style={{
                position: "absolute",
                ...pos,
                zIndex: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: pos.alignItems,
                fontSize: 11,
                fontWeight: 500,
                color: "#5c4d3f",
                lineHeight: 1.25,
                textAlign: id === "tr" || id === "br" ? "right" : "left",
                wordBreak: "break-word",
                maxWidth: "min(46%, 200px)",
                pointerEvents: "none",
              }}
              title={text}
            >
              {text}
            </div>
          );
        }

        if (!onSlotChange) return null;

        return (
          <PrintCornerEditCell
            key={id}
            id={id}
            pos={pos}
            slot={slot}
            text={text}
            showReleaseWait={showReleaseWait}
            active={activeCornerId === id}
            onActivate={() => setActiveCornerId(id)}
            onDeactivateIfInactive={() => tryDeactivate(id)}
            rootRef={(el) => {
              cornerRootRefs.current[id] = el;
            }}
            onSlotChange={onSlotChange}
          />
        );
      })}
    </>
  );
}
