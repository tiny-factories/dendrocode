/**
 * localStorage cache with TTL for tree ring data.
 */

const PREFIX = "treering:";
const DEFAULT_MAX_AGE = 60 * 60 * 1000; // 1 hour

export function getCache(slug) {
  try {
    const raw = localStorage.getItem(PREFIX + slug);
    if (!raw) return null;
    const { data, cachedAt } = JSON.parse(raw);
    return { data, cachedAt };
  } catch {
    return null;
  }
}

export function setCache(slug, data) {
  try {
    localStorage.setItem(PREFIX + slug, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    // localStorage full or unavailable
  }
}

export function isFresh(slug, maxAge = DEFAULT_MAX_AGE) {
  const cached = getCache(slug);
  if (!cached) return false;
  return Date.now() - cached.cachedAt < maxAge;
}

/**
 * Get gallery entries from localStorage.
 */
export function getGalleryEntries() {
  try {
    const raw = localStorage.getItem(PREFIX + "gallery:entries");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addGalleryEntry(entry) {
  try {
    const entries = getGalleryEntries();
    // Don't duplicate
    if (entries.find((e) => e.slug === entry.slug)) return;
    entries.unshift(entry);
    // Keep max 50
    if (entries.length > 50) entries.length = 50;
    localStorage.setItem(PREFIX + "gallery:entries", JSON.stringify(entries));
  } catch {
    // ignore
  }
}
