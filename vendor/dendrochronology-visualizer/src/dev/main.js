import { drawDendroRings } from "../index.js";

/** @type {HTMLCanvasElement | null} */
const canvas = document.querySelector("#chart");

if (!canvas) {
  throw new Error("Missing #chart canvas element.");
}

const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("Canvas 2D context is unavailable.");
}

const rings = [
  { width: 1.4, texture: 0.12, label: "Year 1", seed: 1234 },
  { width: 1.7, texture: 0.18, label: "Year 2", seed: 2323 },
  { width: 1.9, texture: 0.21, label: "Year 3", seed: 3101 },
  { width: 2.3, texture: 0.34, label: "Year 4", seed: 4421 },
  { width: 3.2, texture: 0.49, label: "Year 5", seed: 5512 },
  { width: 2.6, texture: 0.42, label: "Year 6", seed: 6631 },
  { width: 1.9, texture: 0.36, label: "Year 7", seed: 7727 },
  { width: 2.9, texture: 0.57, label: "Year 8", seed: 8803 },
  { width: 3.8, texture: 0.66, label: "Year 9", seed: 9917 },
  { width: 2.5, texture: 0.47, label: "Year 10", seed: 10567 },
  { width: 3.4, texture: 0.73, label: "Year 11", seed: 11681 },
  { width: 2.1, texture: 0.58, label: "Year 12", seed: 12721 },
  { width: 4.1, texture: 0.84, label: "Year 13", seed: 13859 },
  { width: 2.7, texture: 0.69, label: "Year 14", seed: 14939 },
  { width: 3.5, texture: 0.91, label: "Year 15", seed: 15101 },
];

drawDendroRings(ctx, rings, {
  size: 600,
  padding: 14,
  minRingWidth: 2,
  maxRingWidth: 14,
});
