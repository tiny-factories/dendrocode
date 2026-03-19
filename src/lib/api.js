/**
 * Client-side API wrapper with fallback chain:
 * 1. localStorage cache (if fresh)
 * 2. /api/tree/:slug serverless route (Vercel KV)
 * 3. Direct GitHub API fetch (client-side fallback)
 */

import { getCache, setCache, isFresh } from "./cache.js";
import { fetchPullRequests, fetchRepoPullRequests } from "../github.js";

/**
 * Fetch tree ring data with layered caching.
 * @param {"user"|"repo"} mode
 * @param {string} value - username or "owner/repo"
 * @param {string} [token] - GitHub token for direct API fallback
 * @returns {Promise<{ pullRequests: Array, repos?: Array }>}
 */
export async function fetchTreeData(mode, value, token) {
  const slug = mode === "repo" ? `repo:${value.replace("/", ":")}` : `user:${value}`;

  // 1. Check localStorage
  if (isFresh(slug)) {
    return getCache(slug).data;
  }

  // 2. Try API route
  try {
    const res = await fetch(`/api/tree/${encodeURIComponent(slug)}`);
    if (res.ok) {
      const data = await res.json();
      const result = {
        pullRequests: data.pullRequests,
        repos: buildRepoStats(data.pullRequests),
      };
      setCache(slug, result);
      return result;
    }
  } catch {
    // API route unavailable (local dev, no Vercel)
  }

  // 3. Direct GitHub API fallback
  let result;
  if (mode === "repo") {
    const [owner, repo] = value.split("/");
    result = await fetchRepoPullRequests(owner, repo, token);
  } else {
    result = await fetchPullRequests(value, token);
  }

  setCache(slug, result);
  return result;
}

function buildRepoStats(pullRequests) {
  const map = {};
  for (const pr of pullRequests) {
    if (!map[pr.repo]) map[pr.repo] = { name: pr.repo, count: 0 };
    map[pr.repo].count++;
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}
