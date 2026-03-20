/**
 * GET /api/account/gallery — trees you shared (requires gh_token).
 */

import { galleryStorageKind, listAccountSharesFromBlob } from "../galleryStorage.js";

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

async function githubLogin(token) {
  const r = await fetch("https://api.github.com/user", {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return typeof u.login === "string" ? u.login : null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const kind = galleryStorageKind();
  if (!kind) {
    return res.status(200).json({ entries: [] });
  }

  const ghToken = parseCookie(req.headers.cookie, "gh_token");
  if (!ghToken) {
    return res.status(401).json({ error: "Sign in required" });
  }

  const login = await githubLogin(ghToken);
  if (!login) {
    return res.status(401).json({ error: "Could not verify GitHub user" });
  }

  try {
    if (kind === "blob") {
      const entries = await listAccountSharesFromBlob(login);
      return res.status(200).json({ entries });
    }

    const { kv } = await import("@vercel/kv");
    const slugs = (await kv.smembers(`gallery:user:${login}`)) || [];
    const entries = [];
    for (const slug of slugs) {
      const data = await kv.get(`tree:${slug}`);
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
    return res.status(200).json({ entries });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
