/**
 * POST /api/gallery/unshare — remove a tree from public Browse (KV or Blob).
 * Body: { slug }. Caller must be the GitHub user who shared it.
 */

import { galleryStorageKind, unshareCommunityFromBlob } from "../galleryStorage.js";

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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const kind = galleryStorageKind();
  if (!kind) {
    return res.status(503).json({
      error:
        "Gallery storage is not configured. Set Vercel KV (KV_REST_*) or BLOB_READ_WRITE_TOKEN.",
    });
  }

  const ghToken = parseCookie(req.headers.cookie, "gh_token");
  if (!ghToken) {
    return res.status(401).json({ error: "Sign in required" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }

  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return res.status(400).json({ error: "Missing slug" });
  }

  const login = await githubLogin(ghToken);
  if (!login) {
    return res.status(401).json({ error: "Could not verify GitHub user" });
  }

  try {
    if (kind === "kv") {
      const { kv } = await import("@vercel/kv");
      const userKey = `gallery:user:${login}`;
      let members = [];
      try {
        members = (await kv.smembers(userKey)) || [];
      } catch {
        members = [];
      }
      if (!members.includes(slug)) {
        return res.status(403).json({ error: "This item is not in your shared list" });
      }
      await kv.srem(userKey, slug);
      await kv.zrem("gallery:index", slug);
      await kv.del(`tree:${slug}`);
    } else {
      const out = await unshareCommunityFromBlob(slug, login);
      if (!out.ok) {
        return res.status(403).json({ error: out.error || "Unshare not allowed" });
      }
    }
    return res.status(200).json({ ok: true, slug });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Unshare failed" });
  }
}
