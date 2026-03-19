import React from "react";

const R = [10, 18, 26, 34, 42];
const VB = 52;
const C = VB / 2;

/**
 * Stylized tree-ring mark: concentric rings animate in from inner → outer.
 */
export default function LandingCtaTreeIcon() {
  return (
    <svg
      width={56}
      height={56}
      viewBox={`0 0 ${VB} ${VB}`}
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      {R.map((r, i) => (
        <circle
          key={r}
          cx={C}
          cy={C}
          r={r}
          fill="none"
          stroke="#6a5a48"
          strokeWidth={i === 0 ? 1.25 : 1}
          strokeOpacity={0.2 + i * 0.08}
          className={`landing-cta-tree-ring landing-cta-tree-ring--${i}`}
        />
      ))}
    </svg>
  );
}
