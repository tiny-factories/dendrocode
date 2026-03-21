import "../lib/loadLocalEnv.js";

/**
 * GET /api/github/release-latest?owner=&repo=
 * Uses gh_token cookie (OAuth) or GITHUB_TOKEN for GitHub API rate limits.
 */

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const owner = typeof req.query.owner === "string" ? req.query.owner.trim() : "";
  const repo = typeof req.query.repo === "string" ? req.query.repo.trim() : "";
  if (!owner || !repo) {
    return res.status(400).json({ error: "Missing owner or repo" });
  }

  const userToken = parseCookie(req.headers.cookie, "gh_token");
  const token = userToken || process.env.GITHUB_TOKEN;

  try {
    const gh = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );

    if (gh.status === 404) {
      return res.status(200).json({ release: null });
    }
    if (gh.status === 403) {
      return res.status(502).json({
        error:
          "GitHub rate limit or forbidden. Sign in with GitHub or configure GITHUB_TOKEN on the server.",
      });
    }
    if (!gh.ok) {
      return res.status(502).json({ error: `GitHub API: ${gh.status}` });
    }

    const j = await gh.json();
    return res.status(200).json({
      release: {
        tagName: j.tag_name || "",
        name: j.name || "",
        publishedAt: j.published_at || null,
      },
    });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Release fetch failed" });
  }
}
