const API = "https://api.github.com";

function headers(token) {
  const h = { Accept: "application/vnd.github.v3+json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * Fetch all pages from a paginated GitHub API endpoint.
 * Follows Link: <url>; rel="next" headers.
 * @param {string} url - Initial URL
 * @param {object} opts - fetch options
 * @param {number} maxPages - Safety limit (default 10 = up to 1000 items at per_page=100)
 */
async function fetchAllPages(url, opts, maxPages = 10) {
  const all = [];
  let page = url;
  let count = 0;
  while (page && count < maxPages) {
    const res = await fetch(page, opts);
    if (!res.ok) {
      if (count === 0) throw res; // Propagate first-page errors
      break; // Stop on subsequent page errors
    }
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) break;
    all.push(...data);
    // Parse Link header for next page
    const link = res.headers.get("link");
    const next = link?.match(/<([^>]+)>;\s*rel="next"/);
    page = next ? next[1] : null;
    count++;
  }
  return all;
}

export async function fetchPullRequests(username, token) {
  const opts = { headers: headers(token) };
  const hasAuth = !!token;
  const maxPRPages = hasAuth ? 5 : 1; // More pages when authenticated

  // Fetch user's repos (paginated)
  let repos;
  try {
    repos = await fetchAllPages(
      `${API}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`,
      opts,
      hasAuth ? 3 : 1
    );
  } catch (res) {
    if (res.status === 404) throw new Error(`User "${username}" not found`);
    if (res.status === 403) {
      throw new Error(
        "GitHub API rate limit (anonymous: ~60 requests/hour per IP). Paste a personal access token under Advanced (token)—“Sign in with GitHub” does not apply to these requests—or try again later."
      );
    }
    throw new Error("Failed to fetch repos");
  }

  if (!repos.length) throw new Error(`No public repos found for "${username}"`);

  const topRepos = repos.filter((r) => !r.fork).slice(0, hasAuth ? 30 : 15);

  // Fetch merged PRs from each repo (paginated)
  const prResults = await Promise.allSettled(
    topRepos.map(async (repo) => {
      try {
        const prs = await fetchAllPages(
          `${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
          opts,
          maxPRPages
        );
        return prs
          .filter((pr) => pr.merged_at)
          .map((pr) => ({
            repo: repo.name,
            number: pr.number,
            title: pr.title,
            mergedAt: pr.merged_at,
          }));
      } catch {
        return [];
      }
    })
  );

  let allPRs = [];
  for (const result of prResults) {
    if (result.status === "fulfilled") allPRs.push(...result.value);
  }

  if (!allPRs.length) throw new Error(`No merged pull requests found for "${username}"`);

  // Sort by merge date, keep most recent
  allPRs.sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));
  const maxPRs = hasAuth ? 200 : 80;
  allPRs = allPRs.slice(-maxPRs);

  // Fetch detail for each PR (with graceful fallback)
  const detailResults = await Promise.allSettled(
    allPRs.map(async (pr) => {
      try {
        const res = await fetch(
          `${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(pr.repo)}/pulls/${pr.number}`,
          opts
        );
        if (!res.ok) {
          return { ...pr, changedFiles: 1, additions: 0, deletions: 0, commits: 1 };
        }
        const detail = await res.json();
        return {
          ...pr,
          changedFiles: detail.changed_files || 1,
          additions: detail.additions || 0,
          deletions: detail.deletions || 0,
          commits: detail.commits || 1,
        };
      } catch {
        // Network error (ERR_ABORTED, etc.) — return with defaults
        return { ...pr, changedFiles: 1, additions: 0, deletions: 0, commits: 1 };
      }
    })
  );

  const pullRequests = detailResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  const repoMap = {};
  for (const pr of pullRequests) {
    if (!repoMap[pr.repo]) repoMap[pr.repo] = { name: pr.repo, count: 0 };
    repoMap[pr.repo].count++;
  }
  const repoStats = Object.values(repoMap).sort((a, b) => b.count - a.count);

  return { pullRequests, repos: repoStats };
}

/**
 * Latest published GitHub release for a repo, or null if none / 404.
 */
export async function fetchLatestRelease(owner, repo, token) {
  const opts = { headers: headers(token) };
  const res = await fetch(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`,
    opts
  );
  if (res.status === 404) return null;
  if (res.status === 403) {
    const err = new Error("GitHub API rate limit or forbidden when fetching release.");
    err.status = 403;
    throw err;
  }
  if (!res.ok) throw new Error(`GitHub releases: ${res.status}`);
  const j = await res.json();
  return {
    tagName: j.tag_name || "",
    name: j.name || "",
    publishedAt: j.published_at || null,
  };
}

export async function fetchRepoPullRequests(owner, repo, token) {
  const opts = { headers: headers(token) };
  const hasAuth = !!token;
  const maxPages = hasAuth ? 10 : 1;

  let allPRs;
  try {
    allPRs = await fetchAllPages(
      `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
      opts,
      maxPages
    );
  } catch (res) {
    if (res.status === 404) throw new Error(`Repo "${owner}/${repo}" not found`);
    if (res.status === 403) {
      throw new Error(
        "GitHub API rate limit (anonymous: ~60 requests/hour per IP). Paste a personal access token under Advanced (token)—“Sign in with GitHub” does not apply to these requests—or try again later."
      );
    }
    throw new Error("Failed to fetch pull requests");
  }

  let merged = allPRs
    .filter((pr) => pr.merged_at)
    .map((pr) => ({ repo, number: pr.number, title: pr.title, mergedAt: pr.merged_at }));

  if (!merged.length) throw new Error(`No merged pull requests found for "${owner}/${repo}"`);

  merged.sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));
  const maxPRs = hasAuth ? 500 : 80;
  merged = merged.slice(-maxPRs);

  const detailResults = await Promise.allSettled(
    merged.map(async (pr) => {
      try {
        const r = await fetch(
          `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pr.number}`,
          opts
        );
        if (!r.ok) return { ...pr, changedFiles: 1, additions: 0, deletions: 0, commits: 1 };
        const d = await r.json();
        return { ...pr, changedFiles: d.changed_files || 1, additions: d.additions || 0, deletions: d.deletions || 0, commits: d.commits || 1 };
      } catch {
        return { ...pr, changedFiles: 1, additions: 0, deletions: 0, commits: 1 };
      }
    })
  );

  const pullRequests = detailResults.filter((r) => r.status === "fulfilled").map((r) => r.value);
  return { pullRequests, repos: [{ name: repo, count: pullRequests.length }] };
}

// Generate demo data for preview
export function generateDemoData() {
  const prs = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const numPRs = 40;
  const repoNames = ["demo-project", "demo-api", "demo-docs"];

  for (let i = 0; i < numPRs; i++) {
    const daysAgo = numPRs - i;
    const repo = repoNames[Math.floor(Math.random() * repoNames.length)];
    const isBig = Math.random() < 0.2;
    const isTiny = Math.random() < 0.3;
    const changedFiles = isTiny ? Math.floor(Math.random() * 3) + 1
      : isBig ? Math.floor(Math.random() * 50) + 15
      : Math.floor(Math.random() * 12) + 2;
    const commits = isTiny ? 1
      : isBig ? Math.floor(Math.random() * 20) + 5
      : Math.floor(Math.random() * 6) + 1;
    const additions = isTiny ? Math.floor(Math.random() * 30) + 1
      : isBig ? Math.floor(Math.random() * 2000) + 200
      : Math.floor(Math.random() * 300) + 10;
    const deletions = isTiny ? Math.floor(Math.random() * 10)
      : isBig ? Math.floor(Math.random() * 800) + 50
      : Math.floor(Math.random() * 100);

    prs.push({
      repo,
      number: i + 1,
      title: `PR #${i + 1}`,
      mergedAt: new Date(now - daysAgo * dayMs * (1 + Math.random())).toISOString(),
      changedFiles,
      additions,
      deletions,
      commits,
    });
  }

  return {
    pullRequests: prs,
    repos: repoNames.map((name) => ({
      name,
      count: prs.filter((p) => p.repo === name).length,
    })),
  };
}
