/**
 * Merge gallery lists: server (KV) first, then localStorage entries, then seed.
 * First occurrence of a slug wins so Browse shows newest server data first.
 */

import { getCache } from "./cache.js";

export function mergeGallerySources(serverEntries, storedEntries, seedEntries) {
  const seen = new Set();
  const out = [];

  const push = (e) => {
    if (!e?.slug || seen.has(e.slug)) return;
    let entry = { ...e };
    if (!entry.pullRequests?.length) {
      const c = getCache(entry.slug);
      if (c?.data?.pullRequests?.length) {
        entry = { ...entry, pullRequests: c.data.pullRequests };
      }
    }
    if (!entry.pullRequests?.length) return;
    seen.add(entry.slug);
    out.push(entry);
  };

  for (const e of serverEntries || []) {
    push({ ...e, category: e.category || "community" });
  }
  for (const e of storedEntries || []) {
    push({ ...e, category: e.category || "community" });
  }
  for (const e of seedEntries || []) {
    push(e);
  }
  return out;
}
