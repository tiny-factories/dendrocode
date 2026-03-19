/**
 * Serverless API route: GET /api/gallery
 * Returns the gallery index — list of cached tree ring slugs.
 */

let kv;
try {
  kv = (await import("@vercel/kv")).kv;
} catch {
  kv = null;
}

export default async function handler(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  if (!kv) {
    return res.status(200).json({ entries: [], source: "no-kv" });
  }

  try {
    // Get most recent entries from sorted set
    const slugs = await kv.zrange("gallery:index", 0, limit - 1, { rev: true });

    if (!slugs.length) {
      return res.status(200).json({ entries: [], source: "kv-empty" });
    }

    // Fetch metadata for each slug
    const entries = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const data = await kv.get(`tree:${slug}`);
          if (!data) return null;
          return {
            slug,
            displayName: data.displayName,
            prCount: data.prCount || data.pullRequests?.length || 0,
            cachedAt: data.cachedAt,
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
