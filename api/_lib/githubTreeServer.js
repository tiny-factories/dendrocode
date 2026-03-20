/**
 * Server-only GitHub tree fetch helpers (no KV).
 * Used by /api/tree and weekly gallery refresh cron.
 */

export const API = "https://api.github.com";
export const DEFAULT_TREE_TTL_SECONDS = 86400;

export function ghHeaders(token) {
  const h = { Accept: "application/vnd.github.v3+json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
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
  const topRepos = repos.filter((r) => !r.fork).slice(0, hasAuth ? 30 : 15);

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
  allPRs = allPRs.slice(-(hasAuth ? 200 : 80));

  const detailResults = await Promise.allSettled(
    allPRs.map(async (pr) => {
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
    }),
  );

  return detailResults.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} [token]
 * @param {{ maxMerged?: number }} [opts] - cap merged PRs (and detail fetches) for batch jobs
 */
export async function fetchRepoPRs(owner, repo, token, opts = {}) {
  const { maxMerged } = opts;
  const fetchOpts = { headers: ghHeaders(token) };
  const hasAuth = !!token;
  const cap = typeof maxMerged === "number" ? maxMerged : hasAuth ? 500 : 80;

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

  const detailResults = await Promise.allSettled(
    merged.map(async (pr) => {
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
    }),
  );

  return detailResults.filter((r) => r.status === "fulfilled").map((r) => r.value);
}
