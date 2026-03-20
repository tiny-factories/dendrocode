/**
 * Serverless API route: GET /api/tree/:slug
 * Fetches tree ring data from KV cache or GitHub API with full pagination.
 */

import { fetchUserPRs, fetchRepoPRs, DEFAULT_TREE_TTL_SECONDS } from "../githubTreeServer.js";

let kv;
try {
  kv = (await import("@vercel/kv")).kv;
} catch {
  kv = null;
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function normalizeSlug(raw) {
  if (raw == null || raw === "") return "";
  const v = Array.isArray(raw) ? raw[0] : raw;
  return String(v);
}

export default async function handler(req, res) {
  try {
    let slug = normalizeSlug(req.query?.slug);
    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    const userToken = parseCookie(req.headers.cookie, "gh_token");
    const token = userToken || process.env.GITHUB_TOKEN;

    const cacheKey = `tree:${slug}`;

    if (kv && !userToken) {
      try {
        const cached = await kv.get(cacheKey);
        if (cached) {
          return res.status(200).json({ ...cached, fromCache: true });
        }
      } catch (e) {
        console.error("KV read error:", e.message);
      }
    }

    let pullRequests;
    let displayName;

    if (slug.startsWith("user:")) {
      const username = slug.slice(5);
      displayName = username;
      pullRequests = await fetchUserPRs(username, token);
    } else if (slug.startsWith("repo:")) {
      const rest = slug.slice(5);
      const idx = rest.indexOf(":");
      if (idx <= 0 || idx === rest.length - 1) {
        return res.status(400).json({ error: "Invalid repo slug" });
      }
      const owner = rest.slice(0, idx);
      const repo = rest.slice(idx + 1);
      displayName = `${owner}/${repo}`;
      pullRequests = await fetchRepoPRs(owner, repo, token);
    } else {
      return res.status(400).json({ error: "Slug must start with user: or repo:" });
    }

    const result = {
      pullRequests,
      displayName,
      cachedAt: new Date().toISOString(),
      prCount: pullRequests.length,
    };

    if (kv && !userToken) {
      try {
        await kv.set(cacheKey, result, { ex: DEFAULT_TREE_TTL_SECONDS });
        await kv.zadd("gallery:index", { score: Date.now(), member: slug });
      } catch (e) {
        console.error("KV write error:", e.message);
      }
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error("/api/tree error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: message });
  }
}
