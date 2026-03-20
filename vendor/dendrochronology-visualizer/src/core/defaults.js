/**
 * Default configuration for dendrochronology ring visualizations.
 */

export const ANGLE_STEPS = 512;
export const STEP = (Math.PI * 2) / ANGLE_STEPS;

export const DEFAULT_OPTIONS = {
  size: 600,
  coreRadius: 8,
  minRingWidth: 1.5,
  maxRingWidth: 10,
  padding: 16,
  palette: {
    background: "#f0ebe4",
    core: "#d8cec0",
    coreBorder: "rgba(100, 70, 40, 0.4)",
    ringStroke: "rgba(85, 58, 28, {opacity})",
    bark1: "rgba(110, 80, 48, 0.3)",
    bark2: "rgba(90, 65, 35, 0.18)",
  },
};
