/**
 * Client-side API wrapper with fallback chain:
 * 1. localStorage cache (if fresh)
 * 2. /api/tree/:slug (credentials included — OAuth gh_token applies on server)
 * 3. Browser → GitHub only with a PAT, or anonymous only in vite dev
 */

import { getCache, setCache, isFresh } from "./cache.js";
import { fetchPullRequests, fetchRepoPullRequests, fetchLatestRelease } from "../github.js";

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
 * @param {string} [token] - Personal access token for browser-only fallback
 * @returns {Promise<{ pullRequests: Array, repos?: Array }>}
 */
export async function fetchTreeData(mode, value, token) {
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
  if (token) {
    if (mode === "repo") {
      const [owner, repo] = value.split("/");
      result = await fetchRepoPullRequests(owner, repo, token);
    } else {
      result = await fetchPullRequests(value, token);
    }
  } else if (import.meta.env.DEV) {
    if (mode === "repo") {
      const [owner, repo] = value.split("/");
      result = await fetchRepoPullRequests(owner, repo, undefined);
    } else {
      result = await fetchPullRequests(value, undefined);
    }
  } else {
    throw new Error(
      "Could not reach the data API from this page. On the deployed app, sign in with GitHub so /api/tree can use your session token, or paste a Personal Access Token under Advanced. Your sign-in cookie is not visible to code that talks directly to api.github.com from the browser.",
    );
  }

  setCache(slug, result);
  return result;
}

/**
 * Latest release — server route uses OAuth cookie or GITHUB_TOKEN.
 * @returns {{ ok: boolean, release: object|null }} ok false = hard failure; release null = no published release
 */
export async function fetchReleaseForRepo(owner, repo, pat) {
  try {
    const res = await fetch(
      `/api/github/release-latest?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      { credentials: "include" },
    );
    if (res.ok) {
      const data = await res.json();
      return { ok: true, release: data.release ?? null };
    }
    if (pat) {
      const release = await fetchLatestRelease(owner, repo, pat);
      return { ok: true, release };
    }
    return { ok: false, release: null };
  } catch {
    if (pat) {
      try {
        const release = await fetchLatestRelease(owner, repo, pat);
        return { ok: true, release };
      } catch {
        return { ok: false, release: null };
      }
    }
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
