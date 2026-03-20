/**
 * Server-only GitHub tree fetch helpers (no KV).
 * Lives at api/githubTreeServer.js so Vercel resolves imports from api/tree/* reliably.
 */

export const API = "https://api.github.com";
export const DEFAULT_TREE_TTL_SECONDS = 86400;

export function ghHeaders(token) {
  const h = { Accept: "application/vnd.github.v3+json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Limit parallel GitHub calls so serverless handlers stay within time/memory limits. */
const PR_DETAIL_BATCH = 18;

async function allSettledInBatches(items, batchSize, mapper) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const batch = await Promise.allSettled(slice.map((item) => mapper(item)));
    results.push(...batch);
  }
  return results;
}

export async function fetchAllPages(url, opts, maxPages = 10) {
  const all = [];
  let pageurl = url;
  let count = 0;
  while (pageurl && count < maxPages) {
    const res = await fetch(pageurl, opts);
    if (!res.ok) {
      if (count === 0) throw new Error(`GitHub API: ${res.status}`);
      break;
    }
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) break;
    all.push(...data);
    const link = res.headers.get("link");
    const next = link?.match(/<([^>]+)>;\s*rel="next"/);
    pageurl = next ? next[1] : null;
    count++;
  }
  return all;
}

export async function fetchUserPRs(username, token) {
  const opts = { headers: ghHeaders(token) };
  const hasAuth = !!token;

  const repos = await fetchAllPages(
    `${API}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`,
    opts,
    hasAuth ? 3 : 1,
  );
  const topRepos = repos.filter((r) => !r.fork).slice(0, hasAuth ? 22 : 15);

  const prResults = await Promise.allSettled(
    topRepos.map(async (repo) => {
      const prs = await fetchAllPages(
        `${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo.name)}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
        opts,
        hasAuth ? 5 : 1,
      );
      return prs.filter((pr) => pr.merged_at).map((pr) => ({
        repo: repo.name,
        number: pr.number,
        title: pr.title,
        mergedAt: pr.merged_at,
      }));
    }),
  );

  let allPRs = prResults.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
  allPRs.sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));
  /* Keep caps modest so /api/tree finishes within serverless timeouts (e.g. 10s Hobby). */
  allPRs = allPRs.slice(-(hasAuth ? 100 : 80));

  const detailResults = await allSettledInBatches(allPRs, PR_DETAIL_BATCH, async (pr) => {
    const res = await fetch(
      `${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(pr.repo)}/pulls/${pr.number}`,
      opts,
    );
    if (!res.ok) return { ...pr, changedFiles: 1, additions: 0, deletions: 0, commits: 1 };
    const d = await res.json();
    return {
      ...pr,
      changedFiles: d.changed_files || 1,
      additions: d.additions || 0,
      deletions: d.deletions || 0,
      commits: d.commits || 1,
    };
  });

  return detailResults.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} [token]
 * @param {{ maxMerged?: number }} [opts]
 */
export async function fetchRepoPRs(owner, repo, token, opts = {}) {
  const { maxMerged } = opts;
  const fetchOpts = { headers: ghHeaders(token) };
  const hasAuth = !!token;
  const cap = typeof maxMerged === "number" ? maxMerged : hasAuth ? 200 : 80;

  const allPRs = await fetchAllPages(
    `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
    fetchOpts,
    hasAuth ? 10 : 1,
  );

  let merged = allPRs
    .filter((pr) => pr.merged_at)
    .map((pr) => ({ repo, number: pr.number, title: pr.title, mergedAt: pr.merged_at }));
  merged.sort((a, b) => new Date(a.mergedAt) - new Date(b.mergedAt));
  merged = merged.slice(-cap);

  const detailResults = await allSettledInBatches(merged, PR_DETAIL_BATCH, async (pr) => {
    const r = await fetch(
      `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pr.number}`,
      fetchOpts,
    );
    if (!r.ok) return { ...pr, changedFiles: 1, additions: 0, deletions: 0, commits: 1 };
    const d = await r.json();
    return {
      ...pr,
      changedFiles: d.changed_files || 1,
      additions: d.additions || 0,
      deletions: d.deletions || 0,
      commits: d.commits || 1,
    };
  });

  return detailResults.filter((r) => r.status === "fulfilled").map((r) => r.value);
}
