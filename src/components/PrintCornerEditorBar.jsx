import React from "react";
import {
  SquareArrowUpLeft,
  SquareArrowUpRight,
  SquareArrowDownLeft,
  SquareArrowDownRight,
} from "lucide-react";
import { PRINT_CORNER_OPTIONS } from "../lib/printCorners.js";

const CORNERS = [
  { id: "tl", label: "Upper left", Icon: SquareArrowUpLeft },
  { id: "tr", label: "Upper right", Icon: SquareArrowUpRight },
  { id: "bl", label: "Lower left", Icon: SquareArrowDownLeft },
  { id: "br", label: "Lower right", Icon: SquareArrowDownRight },
];

/**
 * Four corner dropdowns: corner icon fused inline with each select (no text labels, no preview lines).
 * Selected row shows resolved print text; hover `title` shows the option category (e.g. Date range).
 * @param {{
 *   slots: Record<string, string>,
 *   cornerTexts: Record<string, string>,
 *   onSlotChange: (id: string, value: string) => void,
 * }} props
 */
export default function PrintCornerEditorBar({ slots, cornerTexts, onSlotChange }) {
  return (
    <div style={styles.wrap} role="group" aria-label="Print corner labels">
      <div style={styles.topRow}>
        {CORNERS.filter((c) => c.id === "tl" || c.id === "tr").map((c) => (
          <CornerField
            key={c.id}
            corner={c}
            slot={slots[c.id] || "none"}
            resolved={cornerTexts?.[c.id] ?? ""}
            onSlotChange={onSlotChange}
          />
        ))}
      </div>

      <div style={styles.bottomRow}>
        {CORNERS.filter((c) => c.id === "bl" || c.id === "br").map((c) => (
          <CornerField
            key={c.id}
            corner={c}
            slot={slots[c.id] || "none"}
            resolved={cornerTexts?.[c.id] ?? ""}
            onSlotChange={onSlotChange}
          />
        ))}
      </div>
    </div>
  );
}

/** @param {{ corner: typeof CORNERS[number], slot: string, resolved: string, onSlotChange: (id: string, v: string) => void }} props */
function CornerField({ corner, slot, resolved, onSlotChange }) {
  const { id, label, Icon } = corner;
  const categoryForSlot =
    PRINT_CORNER_OPTIONS.find((o) => o.value === slot)?.label ?? "Corner label";

  return (
    <div style={styles.compound}>
      <span style={styles.iconSlot} aria-hidden>
        <Icon size={18} strokeWidth={1.65} style={styles.cellIcon} />
      </span>
      <select
        value={slot}
        onChange={(e) => onSlotChange(id, e.target.value)}
        aria-label={`${label} corner label`}
        title={categoryForSlot}
        style={styles.select}
      >
        {PRINT_CORNER_OPTIONS.map((o) => {
          const isSelected = o.value === slot;
          const r = (resolved || "").trim();
          let text = o.label;
          if (isSelected) {
            if (o.value === "none") text = "Empty";
            else text = r || o.label;
          }
          return (
            <option key={o.value} value={o.value}>
              {text}
            </option>
          );
        })}
      </select>
    </div>
  );
}

const styles = {
  wrap: {
    width: "100%",
    maxWidth: 420,
    marginLeft: "auto",
    marginRight: "auto",
    marginTop: 14,
    padding: "12px 12px 14px",
    border: "1px solid #e8e0d6",
    borderRadius: 10,
    background: "linear-gradient(180deg, rgba(255, 252, 248, 0.98) 0%, rgba(245, 240, 235, 0.5) 100%)",
    boxSizing: "border-box",
  },
  topRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    alignItems: "stretch",
  },
  bottomRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    alignItems: "stretch",
    marginTop: 10,
  },
  compound: {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    minWidth: 0,
    border: "1px solid #d4c8b8",
    borderRadius: 6,
    background: "#fffefb",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  iconSlot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 36,
    borderRight: "1px solid rgba(212, 200, 184, 0.85)",
    background: "rgba(255, 252, 248, 0.9)",
  },
  cellIcon: {
    color: "rgba(45, 106, 79, 0.88)",
  },
  select: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: 500,
    padding: "8px 10px",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    color: "#3a3028",
    cursor: "pointer",
    fontFamily: "inherit",
    boxSizing: "border-box",
    outline: "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
