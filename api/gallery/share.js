/**
 * POST /api/gallery/share
 * Publish the current ring (pull requests on canvas) to KV for Browse gallery.
 * Requires GitHub OAuth session (gh_token cookie).
 */

let kv;
try {
  kv = (await import("@vercel/kv")).kv;
} catch {
  kv = null;
}

const SHARE_TTL_SECONDS = 60 * 86400; // 60 days

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function validSlug(slug) {
  if (typeof slug !== "string") return false;
  if (slug.startsWith("user:")) {
    const u = slug.slice(5);
    if (u === "demo") return false;
    return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(u);
  }
  if (slug.startsWith("repo:")) {
    const rest = slug.slice(5);
    const idx = rest.indexOf(":");
    if (idx <= 0 || idx === rest.length - 1) return false;
    const owner = rest.slice(0, idx);
    const repo = rest.slice(idx + 1);
    if (!owner || !repo || owner.length > 200 || repo.length > 200) return false;
    return /^[a-zA-Z0-9._-]+$/.test(owner) && /^[a-zA-Z0-9._-]+$/.test(repo);
  }
  return false;
}

function sanitizePullRequests(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) return null;
  const out = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const repo = String(p.repo || "").trim().slice(0, 200);
    const title = String(p.title || "").trim().slice(0, 500);
    const number = Number(p.number);
    if (!repo || !Number.isFinite(number) || number < 1 || number > 1e9) continue;
    const mergedAt =
      typeof p.mergedAt === "string" && p.mergedAt.length > 0
        ? p.mergedAt.slice(0, 48)
        : new Date().toISOString();
    out.push({
      repo,
      number: Math.trunc(number),
      title,
      mergedAt,
      changedFiles: clampInt(p.changedFiles, 1, 99999),
      additions: clampInt(p.additions, 0, 10_000_000),
      deletions: clampInt(p.deletions, 0, 10_000_000),
      commits: clampInt(p.commits, 1, 99_999),
    });
  }
  return out.length ? out : null;
}

function clampInt(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!kv) {
    return res.status(503).json({ error: "Gallery storage is not configured" });
  }

  const ghToken = parseCookie(req.headers.cookie, "gh_token");
  if (!ghToken) {
    return res.status(401).json({
      error: "Sign in with GitHub to share your tree on the public Browse gallery.",
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid body" });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const displayName =
    typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 200) : "";
  const pullRequests = sanitizePullRequests(body?.pullRequests);

  if (!validSlug(slug)) {
    return res.status(400).json({ error: "Invalid slug" });
  }
  if (!displayName || displayName.toLowerCase() === "demo") {
    return res.status(400).json({ error: "Invalid display name" });
  }
  if (!pullRequests) {
    return res.status(400).json({ error: "Invalid or empty pullRequests" });
  }

  const now = new Date().toISOString();
  const payload = {
    pullRequests,
    displayName,
    prCount: pullRequests.length,
    cachedAt: now,
    category: "community",
    sharedToGallery: true,
  };

  try {
    const cacheKey = `tree:${slug}`;
    await kv.set(cacheKey, payload, { ex: SHARE_TTL_SECONDS });
    await kv.zadd("gallery:index", { score: Date.now(), member: slug });
    return res.status(200).json({ ok: true, slug });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Save failed" });
  }
}
