/**
 * Metrics derived from gallery entries for browse sorting (ring-inspired).
 */

function stdev(values) {
  if (values.length < 2) return 0;
  const m = values.reduce((s, x) => s + x, 0) / values.length;
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

/**
 * @param {{ pullRequests?: Array<{ mergedAt?: string, changedFiles?: number }> }} entry
 * @returns {{ ringCount: number, avgMergeGapDays: number | null, widthStdev: number }}
 */
export function getGalleryEntryMetrics(entry) {
  const prs = Array.isArray(entry.pullRequests) ? entry.pullRequests : [];
  const ringCount = prs.length;
  const times = prs
    .map((p) => new Date(p.mergedAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  let avgMergeGapDays = null;
  if (times.length >= 2) {
    let sum = 0;
    for (let i = 1; i < times.length; i++) {
      sum += (times[i] - times[i - 1]) / 86400000;
    }
    avgMergeGapDays = sum / (times.length - 1);
  }

  const widths = prs.map((p) => Math.max(0, Number(p.changedFiles) || 0));
  const widthStdev = stdev(widths);

  return { ringCount, avgMergeGapDays, widthStdev };
}

/**
 * @param {ReturnType<typeof getGalleryEntryMetrics>} a
 * @param {ReturnType<typeof getGalleryEntryMetrics>} b
 */
export function compareLooseRhythm(a, b) {
  if (a.avgMergeGapDays == null && b.avgMergeGapDays == null) return 0;
  if (a.avgMergeGapDays == null) return 1;
  if (b.avgMergeGapDays == null) return -1;
  return b.avgMergeGapDays - a.avgMergeGapDays;
}

export function compareTightRhythm(a, b) {
  if (a.avgMergeGapDays == null && b.avgMergeGapDays == null) return 0;
  if (a.avgMergeGapDays == null) return 1;
  if (b.avgMergeGapDays == null) return -1;
  return a.avgMergeGapDays - b.avgMergeGapDays;
}
