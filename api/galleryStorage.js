/**
 * Shared gallery persistence: prefer Vercel KV when KV_* env is set, else Vercel Blob (BLOB_READ_WRITE_TOKEN).
 */

const MANIFEST_PATH = "dendrocode-gallery/manifest.json";

/** Private store: gallery is only read/written server-side with BLOB_READ_WRITE_TOKEN. */
const GALLERY_BLOB_ACCESS = "private";

function slugToTreePath(slug) {
  const id = Buffer.from(slug, "utf8").toString("base64url");
  return `dendrocode-gallery/trees/${id}.json`;
}

function emptyManifest() {
  return { version: 1, items: [], byUser: {} };
}

/** @returns {"kv" | "blob" | null} */
export function galleryStorageKind() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) return "kv";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return null;
}

async function readManifest(get) {
  let result;
  try {
    result = await get(MANIFEST_PATH, { access: GALLERY_BLOB_ACCESS });
  } catch {
    return emptyManifest();
  }
  if (!result || result.statusCode !== 200 || !result.stream) return emptyManifest();
  try {
    const text = await new Response(result.stream).text();
    const m = JSON.parse(text);
    if (!m || m.version !== 1 || !Array.isArray(m.items) || typeof m.byUser !== "object") return emptyManifest();
    return m;
  } catch {
    return emptyManifest();
  }
}

async function readTreePayload(get, slug) {
  const pathname = slugToTreePath(slug);
  let result;
  try {
    result = await get(pathname, { access: GALLERY_BLOB_ACCESS });
  } catch {
    return null;
  }
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  try {
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function putJson(put, pathname, obj) {
  await put(pathname, JSON.stringify(obj), {
    access: GALLERY_BLOB_ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

function mergeCommunityShare(manifest, slug, login, t) {
  const items = manifest.items.filter((x) => x.slug !== slug);
  items.push({ slug, t });
  const byUser = { ...manifest.byUser };
  const set = new Set(byUser[login] || []);
  set.add(slug);
  byUser[login] = [...set];
  return { version: 1, items, byUser };
}

/**
 * @param {object} payload — same shape as KV (pullRequests, displayName, …)
 */
export async function shareCommunityToBlob(slug, payload, login) {
  const { put, get } = await import("@vercel/blob");
  const treePath = slugToTreePath(slug);
  const manifest = await readManifest(get);
  const next = mergeCommunityShare(manifest, slug, login, Date.now());
  await putJson(put, treePath, payload);
  await putJson(put, MANIFEST_PATH, next);
}

/** Popular / cron entries: update tree + gallery index only (no byUser). */
export async function upsertPopularTreeBlob(slug, payload) {
  const { put, get } = await import("@vercel/blob");
  const treePath = slugToTreePath(slug);
  const manifest = await readManifest(get);
  const t = Date.now();
  const items = manifest.items.filter((x) => x.slug !== slug);
  items.push({ slug, t });
  await putJson(put, treePath, payload);
  await putJson(put, MANIFEST_PATH, {
    version: 1,
    items,
    byUser: manifest.byUser || {},
  });
}

export async function unshareCommunityFromBlob(slug, login) {
  const { put, get, del } = await import("@vercel/blob");
  const manifest = await readManifest(get);
  const userSlugs = manifest.byUser[login] || [];
  if (!userSlugs.includes(slug)) {
    return { ok: false, error: "This item is not in your shared list" };
  }
  const byUser = {
    ...manifest.byUser,
    [login]: userSlugs.filter((s) => s !== slug),
  };
  const items = manifest.items.filter((x) => x.slug !== slug);
  await putJson(put, MANIFEST_PATH, { version: 1, items, byUser });
  try {
    await del(slugToTreePath(slug));
  } catch {
    /* stale path ok */
  }
  return { ok: true, slug };
}

function entryFromTree(slug, data) {
  if (!data || !Array.isArray(data.pullRequests) || !data.pullRequests.length) return null;
  return {
    slug,
    displayName: data.displayName,
    prCount: data.prCount || data.pullRequests.length,
    cachedAt: data.cachedAt,
    category: data.category || (data.sharedToGallery ? "community" : undefined),
    pullRequests: data.pullRequests,
  };
}

/** Slug payload when present in gallery blob store (shared or popular). */
export async function getGalleryTreeBlobIfPresent(slug) {
  try {
    const { get } = await import("@vercel/blob");
    return await readTreePayload(get, slug);
  } catch {
    return null;
  }
}

export async function listGalleryFromBlob(limit) {
  const { get } = await import("@vercel/blob");
  const manifest = await readManifest(get);
  const sorted = [...manifest.items].sort((a, b) => b.t - a.t).slice(0, limit);
  const entries = [];
  for (const { slug } of sorted) {
    const data = await readTreePayload(get, slug);
    const row = entryFromTree(slug, data);
    if (row) entries.push(row);
  }
  return entries;
}

export async function listAccountSharesFromBlob(login) {
  const { get } = await import("@vercel/blob");
  const manifest = await readManifest(get);
  const slugs = manifest.byUser[login] || [];
  const entries = [];
  for (const slug of slugs) {
    const data = await readTreePayload(get, slug);
    if (!data?.pullRequests?.length) continue;
    entries.push({
      slug,
      displayName: data.displayName || slug,
      prCount: data.prCount || data.pullRequests.length,
      pullRequests: data.pullRequests,
      cachedAt: data.cachedAt,
    });
  }
  entries.sort((a, b) => String(b.cachedAt || "").localeCompare(String(a.cachedAt || "")));
  return entries;
}
