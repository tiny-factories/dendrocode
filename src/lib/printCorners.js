/** Slugs for what can appear in each print-preview / export corner. */
export const PRINT_CORNER_SLOT_IDS = ["tl", "tr", "bl", "br"];

/** @typedef {'none' | 'name' | 'contributions' | 'dateRange' | 'orgRepo' | 'releaseTag' | 'printSpec'} PrintCornerAttr */

export const PRINT_CORNER_OPTIONS = [
  { value: "none", label: "Empty" },
  { value: "name", label: "Display name" },
  { value: "contributions", label: "Contributions" },
  { value: "dateRange", label: "Date range" },
  { value: "orgRepo", label: "Org / repo" },
  { value: "releaseTag", label: "Release tag" },
  { value: "printSpec", label: "Print size & paper" },
];

/** Default corner placement: name top-left, date top-right, contributions bottom-left, print spec bottom-right. */
export const PRINT_CORNER_DEFAULTS = /** @type {Record<string, PrintCornerAttr>} */ ({
  tl: "name",
  tr: "dateRange",
  bl: "contributions",
  br: "printSpec",
});

/**
 * @param {Array<{ mergedAt?: string }>} pullRequests
 */
export function contributionDateRangeLabel(pullRequests) {
  if (!pullRequests?.length) return "";
  const years = pullRequests
    .map((pr) => new Date(pr.mergedAt).getFullYear())
    .filter((y) => Number.isFinite(y));
  if (!years.length) return "";
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}` : `${min}–${max}`;
}

/**
 * Resolve visible strings for each corner (export + preview).
 * @param {{
 *   slots: Record<string, PrintCornerAttr>,
 *   displayName: string,
 *   creditTarget: { owner: string, repo: string } | null,
 *   pullRequests: Array<{ mergedAt?: string }>,
 *   releaseFetchState: string,
 *   releaseDetail: { tagName?: string, name?: string } | null,
 *   printSpecLine?: string,
 * }} args
 */
export function resolvePrintCornerTexts(args) {
  const {
    slots,
    displayName,
    creditTarget,
    pullRequests,
    releaseFetchState,
    releaseDetail,
    printSpecLine,
  } = args;

  const dn = (displayName || "").trim();
  const orgRepoLine = creditTarget ? `${creditTarget.owner} / ${creditTarget.repo}` : "";
  const contribLine = `${pullRequests.length} contributions · dendrochronology`;
  const rangeLine = contributionDateRangeLabel(pullRequests);
  let releaseLine = "";
  if (releaseFetchState === "done" && releaseDetail) {
    releaseLine = releaseDetail.tagName || releaseDetail.name || "";
  }

  /** @param {PrintCornerAttr} attr */
  function forAttr(attr) {
    switch (attr) {
      case "none":
        return "";
      case "name":
        return dn;
      case "contributions":
        return contribLine;
      case "dateRange":
        return rangeLine;
      case "orgRepo":
        return orgRepoLine;
      case "releaseTag":
        return releaseLine;
      case "printSpec":
        return printSpecLine || "";
      default:
        return "";
    }
  }

  /** @type {Record<string, string>} */
  const out = {};
  for (const id of PRINT_CORNER_SLOT_IDS) {
    out[id] = forAttr(slots[id] || "none");
  }
  return out;
}
