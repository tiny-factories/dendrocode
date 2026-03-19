/**
 * Transforms GitHub pull request data into the generic Ring format
 * used by the dendrochronology-visualizer library.
 */
import { hashString } from "dendrochronology-visualizer";

/**
 * Convert an array of GitHub PRs into Ring data.
 * @param {Array<{ repo: string, number: number, title: string, mergedAt: string, changedFiles: number, commits: number, additions: number, deletions: number }>} pullRequests
 * @returns {Array<{ width: number, texture: number, label: string, seed: number, meta: Record<string, any> }>}
 */
export function githubPRsToRings(pullRequests) {
  return pullRequests.map((pr) => ({
    width: pr.changedFiles,
    texture: pr.commits,
    label: `${pr.repo}#${pr.number}: ${pr.title}`,
    seed: hashString(`${pr.repo}${pr.number}${pr.mergedAt}`),
    meta: {
      merged: new Date(pr.mergedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      details: `${pr.changedFiles} file${pr.changedFiles !== 1 ? "s" : ""} · ${pr.commits} commit${pr.commits !== 1 ? "s" : ""} · +${pr.additions} -${pr.deletions}`,
    },
  }));
}
