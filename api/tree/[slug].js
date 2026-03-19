/**
 * Serverless API route: GET /api/tree/:slug
 * Fetches tree ring data from KV cache or GitHub API with full pagination.
 */

let kv;
try {
  kv = (await import("@vercel/kv")).kv;
} catch {
  kv = null;
}

const API = "https://api.github.com";
const TTL_SECONDS = 86400;

function ghHeaders(token) {
  const h = { Accept: "application/vnd.github.v3+json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

async function fetchAllPages(url, opts, maxPages = 10) {
  const all = [];
  let page = url;
  let count = 0;
  while (page && count < maxPages) {
    const res = await fetch(page, opts);
    if (!res.ok) { if (count === 0) throw new Error(`GitHub API: ${res.status}`); break; }
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) break;
    all.push(...data);
    const link = res.headers.get("link");
    const next = link?.match(/<([^>]+)>;\s*rel="next"/);
    page = next ? next[1] : null;
    count++;
  }
  return all;
}

async function fetchUserPRs(username, token) {
  const opts = { headers: ghHeaders(token) };
  const hasAuth = !!token;

  const repos = await fetchAllPages(
    `${API}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`,
    opts,
    hasAuth ? 3 : 1
  );
  const topRepos = repos.filter((r) => !r.fork).slice(0, hasAuth ? 30 : 15);

  const prResults = await Promise.allSettled(
    topRepos.map(async (repo) => {
      const prs = await fetchAllPages(
        `${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
        opts,
        hasAuth ? 5 : 1
      );
      return prs.filter((pr) => pr.merged_at).map((pr) => ({
        repo: repo.name, number: pr.number, title: pr.title, mergedAt: pr.merged_at,
      }));
    })
  );

  let allPRs = prResults.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
  allPRs.sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));
  allPRs = allPRs.slice(-(hasAuth ? 200 : 80));

  const detailResults = await Promise.allSettled(
    allPRs.map(async (pr) => {
      const res = await fetch(
        `${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(pr.repo)}/pulls/${pr.number}`,
        opts
      );
      if (!res.ok) return { ...pr, changedFiles: 1, additions: 0, deletions: 0, commits: 1 };
      const d = await res.json();
      return { ...pr, changedFiles: d.changed_files || 1, additions: d.additions || 0, deletions: d.deletions || 0, commits: d.commits || 1 };
    })
  );

  return detailResults.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

async function fetchRepoPRs(owner, repo, token) {
  const opts = { headers: ghHeaders(token) };
  const hasAuth = !!token;

  const allPRs = await fetchAllPages(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
    opts,
    hasAuth ? 10 : 1
  );

  let merged = allPRs.filter((pr) => pr.merged_at).map((pr) => ({
    repo, number: pr.number, title: pr.title, mergedAt: pr.merged_at,
  }));
  merged.sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));
  merged = merged.slice(-(hasAuth ? 500 : 80));

  const detailResults = await Promise.allSettled(
    merged.map(async (pr) => {
      const r = await fetch(
        `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pr.number}`,
        opts
      );
      if (!r.ok) return { ...pr, changedFiles: 1, additions: 0, deletions: 0, commits: 1 };
      const d = await r.json();
      return { ...pr, changedFiles: d.changed_files || 1, additions: d.additions || 0, deletions: d.deletions || 0, commits: d.commits || 1 };
    })
  );

  return detailResults.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

export default async function handler(req, res) {
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: "Missing slug" });

  // Get auth token from cookie or env
  const userToken = parseCookie(req.headers.cookie, "gh_token");
  const token = userToken || process.env.GITHUB_TOKEN;

  const cacheKey = `tree:${slug}`;

  // Try KV cache (only for non-authenticated requests to avoid serving stale private data)
  if (kv && !userToken) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) return res.status(200).json({ ...cached, fromCache: true });
    } catch (e) {
      console.error("KV read error:", e.message);
    }
  }

  try {
    let pullRequests, displayName;

    if (slug.startsWith("user:")) {
      const username = slug.slice(5);
      displayName = username;
      pullRequests = await fetchUserPRs(username, token);
    } else if (slug.startsWith("repo:")) {
      const parts = slug.slice(5).split(":");
      if (parts.length !== 2) return res.status(400).json({ error: "Invalid repo slug" });
      displayName = `${parts[0]}/${parts[1]}`;
      pullRequests = await fetchRepoPRs(parts[0], parts[1], token);
    } else {
      return res.status(400).json({ error: "Slug must start with user: or repo:" });
    }

    const result = {
      pullRequests,
      displayName,
      cachedAt: new Date().toISOString(),
      prCount: pullRequests.length,
    };

    // Cache only public data (no user token)
    if (kv && !userToken) {
      try {
        await kv.set(cacheKey, result, { ex: TTL_SECONDS });
        await kv.zadd("gallery:index", { score: Date.now(), member: slug });
      } catch (e) {
        console.error("KV write error:", e.message);
      }
    }

    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
