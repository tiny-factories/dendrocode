/**
 * Procedural noise utilities for dendrochronology ring generation.
 * All functions are pure and deterministic given the same inputs.
 */

/**
 * Generate a deterministic hash from a string.
 * @param {string} str
 * @returns {number} positive integer hash
 */
export function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Seeded pseudo-random number in [0, 1).
 * @param {number} n - seed value
 * @returns {number}
 */
export function pseudoRand(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Multi-frequency noise combining low and high frequency components.
 * @param {number} seed
 * @param {number} angle - radians
 * @param {number} amplitude
 * @param {number} lowFreq
 * @param {number} highFreq
 * @param {number} hfMix - 0-1 blend of high frequency
 * @returns {number}
 */
export function ringNoise(seed, angle, amplitude, lowFreq, highFreq, hfMix) {
  const lo = sharpNoise(seed, angle, lowFreq);
  const hi = sharpNoise(seed + 7, angle, highFreq);
  return (lo * (1 - hfMix) + hi * hfMix) * amplitude;
}

/**
 * Two-octave sine-based noise.
 * @param {number} seed
 * @param {number} angle
 * @param {number} frequency
 * @returns {number}
 */
export function sharpNoise(seed, angle, frequency) {
  const a = Math.sin(seed * 0.001 + angle * frequency) * 43758.5453;
  const b = Math.sin(seed * 0.0017 + angle * frequency * 2.3) * 23421.631;
  const n1 = (a - Math.floor(a)) - 0.5;
  const n2 = (b - Math.floor(b)) - 0.5;
  return (n1 * 0.7 + n2 * 0.3) * 2;
}

/**
 * Smooth a circular edge array using convolution.
 * @param {Float32Array} edge - array of radius values
 * @param {number} passes - number of smoothing passes
 * @returns {Float32Array}
 */
export function smoothEdge(edge, passes) {
  let current = new Float32Array(edge);
  const len = current.length;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const prev = current[(i - 1 + len) % len];
      const curr = current[i];
      const nxt = current[(i + 1) % len];
      next[i] = prev * 0.2 + curr * 0.6 + nxt * 0.2;
    }
    current = next;
  }
  return current;
}
