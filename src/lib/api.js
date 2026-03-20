/**
 * Client-side API wrapper:
 * 1. localStorage cache (if fresh)
 * 2. /api/tree/:slug (credentials: include — signed-in users send gh_token; server uses OAuth or GITHUB_TOKEN)
 *
 * If `vite` alone (no /api), dev falls back to unauthenticated browser → GitHub (strict rate limits).
 * Use `vercel dev` + sign in for realistic limits locally.
 */

import { getCache, setCache, isFresh } from "./cache.js";
import { fetchPullRequests, fetchRepoPullRequests } from "../github.js";

function looksLikeNetworkFailure(e) {
  return (
    e instanceof TypeError ||
    (e instanceof Error && /fail(ed)? to fetch|networkerror|load failed/i.test(e.message))
  );
}

/**
 * Fetch tree ring data with layered caching.
 * @param {"user"|"repo"} mode
 * @param {string} value - username or "owner/repo"
 * @returns {Promise<{ pullRequests: Array, repos?: Array }>}
 */
export async function fetchTreeData(mode, value) {
  const slug = mode === "repo" ? `repo:${value.replace("/", ":")}` : `user:${value}`;

  if (isFresh(slug)) {
    return getCache(slug).data;
  }

  try {
    const res = await fetch(`/api/tree/${encodeURIComponent(slug)}`, {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      const result = {
        pullRequests: data.pullRequests,
        repos: buildRepoStats(data.pullRequests),
      };
      setCache(slug, result);
      return result;
    }

    let message = `Could not load tree data (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) message = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  } catch (e) {
    if (!looksLikeNetworkFailure(e)) {
      throw e;
    }
  }

  let result;
  if (import.meta.env.DEV) {
    if (mode === "repo") {
      const [owner, repo] = value.split("/");
      result = await fetchRepoPullRequests(owner, repo, undefined);
    } else {
      result = await fetchPullRequests(value, undefined);
    }
  } else {
    throw new Error(
      "Could not load tree data. Sign in with GitHub (top bar) so requests go through the app’s server with your token—much higher GitHub rate limits than anonymous access.",
    );
  }

  setCache(slug, result);
  return result;
}

/**
 * Latest release — /api/github/release-latest (OAuth cookie or server GITHUB_TOKEN).
 * @returns {{ ok: boolean, release: object|null }}
 */
export async function fetchReleaseForRepo(owner, repo) {
  try {
    const res = await fetch(
      `/api/github/release-latest?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      { credentials: "include" },
    );
    if (res.ok) {
      const data = await res.json();
      return { ok: true, release: data.release ?? null };
    }
    return { ok: false, release: null };
  } catch {
    return { ok: false, release: null };
  }
}

function buildRepoStats(pullRequests) {
  const map = {};
  for (const pr of pullRequests) {
    if (!map[pr.repo]) map[pr.repo] = { name: pr.repo, count: 0 };
    map[pr.repo].count++;
  }
  return Object.values(map).sort((a, b) => b.count - a.count);
}
