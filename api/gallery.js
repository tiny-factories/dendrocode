/**
 * Serverless API route: GET /api/gallery
 * Returns the gallery index — list of cached tree ring slugs.
 */

import { galleryStorageKind, listGalleryFromBlob } from "./galleryStorage.js";

export default async function handler(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const kind = galleryStorageKind();

  if (!kind) {
    return res.status(200).json({ entries: [], source: "no-storage" });
  }

  try {
    if (kind === "blob") {
      const entries = await listGalleryFromBlob(limit);
      return res.status(200).json({ entries, source: "blob" });
    }

    const { kv } = await import("@vercel/kv");
    const slugs = await kv.zrange("gallery:index", 0, limit - 1, { rev: true });

    if (!slugs.length) {
      return res.status(200).json({ entries: [], source: "kv-empty" });
    }

    const entries = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const data = await kv.get(`tree:${slug}`);
          if (!data || !Array.isArray(data.pullRequests) || !data.pullRequests.length) return null;
          return {
            slug,
            displayName: data.displayName,
            prCount: data.prCount || data.pullRequests.length,
            cachedAt: data.cachedAt,
            category: data.category || (data.sharedToGallery ? "community" : undefined),
            pullRequests: data.pullRequests,
          };
        } catch {
          return null;
        }
      })
    );

    return res.status(200).json({
      entries: entries.filter(Boolean),
      source: "kv",
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
