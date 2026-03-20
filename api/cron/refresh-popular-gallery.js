/**
 * Weekly cron (Vercel): refresh top public repos into KV or Blob for Browse.
 * Secured with CRON_SECRET (Authorization: Bearer …).
 *
 * Uses one server GITHUB_TOKEN burst per run; visitors read cache (no GitHub) for those slugs.
 */

import { fetchRepoPRs } from "../githubTreeServer.js";
import { galleryStorageKind, upsertPopularTreeBlob } from "../galleryStorage.js";

const WEEKLY_CACHE_SECONDS = 8 * 86400; // overlap weekly schedule
/** Keep small so the job finishes within serverless time limits (set maxDuration in vercel.json). */
const MAX_REPOS = 6;
/** Cap merged PRs per repo (each gets a detail request) to control runtime + GitHub load. */
const CRON_MAX_MERGED_PR = 48;

function authorize(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers?.authorization || "";
  return auth === `Bearer ${secret}`;
}

/**
 * Popular + somewhat active public repos (GitHub search; 1 request).
 */
function searchQuery() {
  const pushed = new Date();
  pushed.setDate(pushed.getDate() - 45);
  const ymd = pushed.toISOString().slice(0, 10);
  return `stars:>35000 is:public archived:false pushed:>${ymd}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!authorize(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const kind = galleryStorageKind();
  if (!kind) {
    return res.status(503).json({ error: "KV or Blob storage not configured for gallery" });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(503).json({ error: "GITHUB_TOKEN required for cron refresh" });
  }

  const q = encodeURIComponent(searchQuery());
  let items = [];
  try {
    const searchRes = await fetch(
      `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${MAX_REPOS}`,
      { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } },
    );
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      return res.status(502).json({
        error: `GitHub search failed: ${searchRes.status}`,
        detail: errText.slice(0, 200),
      });
    }
    const body = await searchRes.json();
    items = body.items || [];
  } catch (e) {
    return res.status(502).json({ error: e.message || "Search failed" });
  }

  const refreshed = [];
  const errors = [];

  for (const item of items) {
    const owner = item.owner?.login;
    const name = item.name;
    if (!owner || !name) continue;

    const slug = `repo:${owner}:${name}`;
    const displayName = item.full_name || `${owner}/${name}`;

    try {
      const pullRequests = await fetchRepoPRs(owner, name, token, { maxMerged: CRON_MAX_MERGED_PR });
      if (!pullRequests.length) {
        errors.push({ slug, reason: "no_merged_prs" });
        continue;
      }

      const payload = {
        pullRequests,
        displayName,
        prCount: pullRequests.length,
        cachedAt: new Date().toISOString(),
        category: "popular-repos",
        source: "weekly-cron",
      };

      if (kind === "kv") {
        const { kv } = await import("@vercel/kv");
        await kv.set(`tree:${slug}`, payload, { ex: WEEKLY_CACHE_SECONDS });
        await kv.zadd("gallery:index", { score: Date.now(), member: slug });
      } else {
        await upsertPopularTreeBlob(slug, payload);
      }
      refreshed.push(slug);
    } catch (e) {
      errors.push({ slug, reason: e.message || "fetch_failed" });
    }
  }

  return res.status(200).json({
    ok: true,
    refreshed,
    errors,
    message:
      "Gallery cache updated from GitHub. Browse serves this data without per-visitor GitHub calls for these slugs.",
  });
}
