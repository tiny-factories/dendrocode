import React, { useRef, useEffect, useState, useMemo } from "react";
import { Search } from "lucide-react";
import TreeRingCard from "./TreeRingCard.jsx";
import GalleryBrowseStamp from "./GalleryBrowseStamp.jsx";
import {
  getGalleryEntryMetrics,
  compareLooseRhythm,
  compareTightRhythm,
} from "../lib/galleryEntryMetrics.js";

/** Ring diameter in browse grid (matches landing stamp density). */
const BROWSE_STAMP_SIZE = 96;

/**
 * Responsive gallery grid of tree ring cards.
 * Uses IntersectionObserver for lazy visibility.
 */
export default function GallerySection({
  entries,
  onSelect,
  title = "Gallery",
  subtitle = "Explore tree rings from open source projects and community members",
  compact = false,
  enableFilters = false,
  showHeader = true,
  nameOnly = false,
}) {
  if (!entries.length) return null;
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [browseSort, setBrowseSort] = useState("default");

  const filterTags = useMemo(() => {
    if (!enableFilters) return [];
    const tagSet = new Set(entries.map((entry) => entry.category || "community"));
    const ordered = FILTER_ORDER.filter((tag) => tagSet.has(tag));
    return ["all", ...ordered];
  }, [entries, enableFilters]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (enableFilters && activeFilter !== "all") {
      list = list.filter((entry) => (entry.category || "community") === activeFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((entry) => (entry.displayName || "").toLowerCase().includes(q));
    }
    return list;
  }, [entries, enableFilters, activeFilter, searchQuery]);

  const sortedBrowseEntries = useMemo(() => {
    if (browseSort === "default") return filteredEntries;
    const list = [...filteredEntries];
    const metricBySlug = new Map(list.map((e) => [e.slug, getGalleryEntryMetrics(e)]));
    const m = (e) => metricBySlug.get(e);
    switch (browseSort) {
      case "rings_more":
        return list.sort((a, b) => m(b).ringCount - m(a).ringCount);
      case "rings_fewer":
        return list.sort((a, b) => m(a).ringCount - m(b).ringCount);
      case "rhythm_loose":
        return list.sort((a, b) => compareLooseRhythm(m(a), m(b)));
      case "rhythm_tight":
        return list.sort((a, b) => compareTightRhythm(m(a), m(b)));
      case "bands_rough":
        return list.sort((a, b) => m(b).widthStdev - m(a).widthStdev);
      case "bands_smooth":
        return list.sort((a, b) => m(a).widthStdev - m(b).widthStdev);
      default:
        return list;
    }
  }, [filteredEntries, browseSort]);

  const sectionStyle = {
    ...styles.section,
    ...(compact ? styles.sectionCompact : {}),
    ...(nameOnly ? styles.sectionNameOnly : {}),
  };
  const filterChipBase = nameOnly ? styles.filterChipNameOnly : styles.filterChip;
  const filterChipActiveStyle = nameOnly ? styles.filterChipNameOnlyActive : styles.filterChipActive;

  return (
    <div style={sectionStyle}>
      <div style={styles.container}>
      {showHeader && (
        <div style={{ ...styles.header, ...(compact ? styles.headerCompact : {}) }}>
          <h2 style={styles.title}>{title}</h2>
          <p style={styles.subtitle}>{subtitle}</p>
        </div>
      )}

      {nameOnly ? (
        <>
          <div style={styles.browseSearchRow}>
            <label style={styles.browseSearchLabelBlock} htmlFor="gallery-search">
              Search
            </label>
            <div style={styles.browseSearchFieldFull}>
              <Search size={16} strokeWidth={1.75} style={styles.browseSearchIcon} aria-hidden />
              <input
                id="gallery-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name or path…"
                autoComplete="off"
                style={styles.browseSearchInput}
              />
            </div>
          </div>
          <div style={styles.browseBody}>
            <aside style={styles.browseSidebar} aria-label="Gallery filters">
              {enableFilters && filterTags.length > 1 && (
                <div style={styles.browseSidebarSection}>
                  <span style={styles.browseSidebarHeading}>Type</span>
                  <div style={styles.browseSidebarChipsType}>
                    {filterTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        style={{
                          ...styles.browseTypeChipSidebar,
                          ...(activeFilter === tag ? styles.browseTypeChipSidebarActive : {}),
                        }}
                        onClick={() => setActiveFilter(tag)}
                      >
                        {FILTER_LABELS[tag] || tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={styles.browseSidebarSection}>
                <span style={styles.browseSidebarHeading}>Arrange</span>
                <div style={styles.browseSidebarChipsType}>
                  {BROWSE_SORT_OPTIONS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      style={{
                        ...styles.browseTypeChipSidebar,
                        ...(browseSort === id ? styles.browseTypeChipSidebarActive : {}),
                      }}
                      onClick={() => setBrowseSort(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.browseSidebarSection}>
                <span style={styles.browseSidebarHeading}>Tags</span>
                <div style={styles.browseTagCloud} role="group" aria-label="Quick filter tags">
                  {BROWSE_QUICK_TAGS.map(({ label, value }) => {
                    const active = searchQuery.trim().toLowerCase() === value.toLowerCase();
                    return (
                      <button
                        key={value}
                        type="button"
                        style={{
                          ...styles.browseQuickTagPill,
                          ...(active ? styles.browseQuickTagPillActive : {}),
                        }}
                        onClick={() => {
                          setSearchQuery(active ? "" : value);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
            <div style={styles.browseResults}>
              <div
                style={{
                  ...styles.grid,
                  ...(compact ? styles.gridCompact : {}),
                  ...styles.gridNameOnly,
                }}
              >
                {filteredEntries.length === 0 ? (
                  <p style={{ ...styles.emptyBrowse, ...styles.emptyBrowseGrid }}>
                    No entries match
                    {searchQuery.trim() ? ` “${searchQuery.trim()}”` : ""}
                    {enableFilters && activeFilter !== "all" ? " in this category" : ""}.
                  </p>
                ) : (
                  sortedBrowseEntries.map((entry) => (
                    <LazyCard key={entry.slug} entry={entry} onSelect={onSelect} nameOnly />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {enableFilters && filterTags.length > 1 && (
            <div style={styles.filtersRow}>
              {filterTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  style={{ ...filterChipBase, ...(activeFilter === tag ? filterChipActiveStyle : {}) }}
                  onClick={() => setActiveFilter(tag)}
                >
                  {FILTER_LABELS[tag] || tag}
                </button>
              ))}
            </div>
          )}
          <div
            style={{
              ...styles.grid,
              ...(compact ? styles.gridCompact : {}),
            }}
          >
            {filteredEntries.length === 0 ? (
              <p style={styles.emptyBrowse}>
                No entries match
                {searchQuery.trim() ? ` “${searchQuery.trim()}”` : ""}
                {enableFilters && activeFilter !== "all" ? " in this category" : ""}.
              </p>
            ) : (
              filteredEntries.map((entry) => (
                <LazyCard key={entry.slug} entry={entry} onSelect={onSelect} nameOnly={false} />
              ))
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

function LazyCard({ entry, onSelect, nameOnly }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ ...styles.cardSlot, ...(nameOnly ? styles.cardSlotBrowseStamp : {}) }}>
      {visible ? (
        nameOnly ? (
          <GalleryBrowseStamp entry={entry} onSelect={onSelect} size={BROWSE_STAMP_SIZE} />
        ) : (
          <TreeRingCard entry={entry} onClick={() => onSelect(entry)} />
        )
      ) : (
        <div style={nameOnly ? styles.skeletonBrowseStamp : styles.skeleton} />
      )}
    </div>
  );
}

const styles = {
  section: {
    minHeight: "100vh",
    padding: "96px 24px 120px",
    background: "#f5f0eb",
  },
  sectionNameOnly: {
    minHeight: "auto",
    width: "100%",
    maxWidth: 1240,
    margin: "0 auto",
    padding: "8px 24px 96px",
    background: "transparent",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: 1240,
    margin: "0 auto",
  },
  sectionCompact: {
    minHeight: "auto",
    padding: "20px 0 0",
    background: "transparent",
  },
  header: {
    textAlign: "left",
    marginBottom: 24,
  },
  headerCompact: {
    textAlign: "left",
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: 500,
    letterSpacing: 0.8,
    color: "#6a5a48",
    textTransform: "none",
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: "#b0a090",
    fontWeight: 400,
    marginTop: 8,
  },
  filtersRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "baseline",
    justifyContent: "flex-start",
    margin: "0 0 18px",
  },
  browseSearchRow: {
    width: "100%",
    margin: "0 0 20px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  browseSearchLabelBlock: {
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(58, 48, 40, 0.45)",
  },
  browseSearchFieldFull: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: "#ffffff",
    border: "1px solid #e4e4e7",
    boxSizing: "border-box",
    width: "100%",
  },
  browseBody: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 28,
  },
  browseSidebar: {
    flex: "0 0 200px",
    width: 200,
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  browseSidebarSection: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  browseSidebarHeading: {
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(58, 48, 40, 0.45)",
  },
  browseSidebarChipsType: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 0,
  },
  browseTagCloud: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    alignContent: "flex-start",
    gap: 8,
  },
  browseQuickTagPill: {
    border: "1px solid rgba(58, 48, 40, 0.2)",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12,
    lineHeight: 1.2,
    color: "#3a3028",
    background: "rgba(255, 255, 255, 0.55)",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "center",
    width: "auto",
    maxWidth: "100%",
    boxSizing: "border-box",
    textDecoration: "none",
    transition: "border-color 0.15s ease, color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease",
  },
  browseQuickTagPillActive: {
    borderColor: "#2d6a4f",
    color: "#1b4332",
    background: "rgba(45, 106, 79, 0.1)",
    fontWeight: 600,
    boxShadow: "inset 0 0 0 1px rgba(45, 106, 79, 0.12)",
  },
  browseTypeChipSidebar: {
    border: "none",
    borderBottom: "1px solid rgba(58, 48, 40, 0.12)",
    borderRadius: 0,
    padding: "6px 0",
    margin: 0,
    fontSize: 12,
    letterSpacing: 0,
    textTransform: "none",
    color: "#3a3028",
    background: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left",
    width: "100%",
    boxSizing: "border-box",
    textDecoration: "none",
  },
  browseTypeChipSidebarActive: {
    borderBottom: "2px solid #2d6a4f",
    color: "#2d6a4f",
    fontWeight: 600,
    paddingBottom: 5,
  },
  browseResults: {
    flex: "1 1 400px",
    minWidth: 0,
  },
  browseSearchIcon: {
    flexShrink: 0,
    color: "rgba(58, 48, 40, 0.4)",
  },
  browseSearchInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
    lineHeight: 1.4,
    color: "#3a3028",
    fontFamily: "inherit",
  },
  browseQuickTag: {
    border: "1px solid rgba(58, 48, 40, 0.18)",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    color: "#3a3028",
    background: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "border-color 0.15s ease, color 0.15s ease",
  },
  browseQuickTagActive: {
    borderColor: "#2d6a4f",
    color: "#2d6a4f",
    fontWeight: 600,
  },
  emptyBrowse: {
    margin: 0,
    fontSize: 14,
    color: "rgba(58, 48, 40, 0.52)",
  },
  emptyBrowseGrid: {
    gridColumn: "1 / -1",
    padding: "24px 4px",
  },
  filterChip: {
    border: "1px solid #d4c8b8",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#8a7a68",
    background: "rgba(255, 255, 255, 0.6)",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  filterChipActive: {
    background: "#6a5a48",
    borderColor: "#6a5a48",
    color: "#f5f0eb",
  },
  filterChipNameOnly: {
    border: "none",
    borderBottom: "1px solid rgba(58, 48, 40, 0.2)",
    borderRadius: 0,
    padding: "4px 0",
    fontSize: 12,
    letterSpacing: 0,
    textTransform: "none",
    color: "#3a3028",
    background: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  filterChipNameOnlyActive: {
    background: "transparent",
    borderBottom: "2px solid #2d6a4f",
    color: "#2d6a4f",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 18,
  },
  gridNameOnly: {
    gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))",
    columnGap: 16,
    rowGap: 56,
  },
  gridCompact: {
    gridTemplateColumns: "1fr",
    gap: 10,
    maxWidth: "none",
    margin: 0,
  },
  cardSlot: {
    minHeight: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardSlotBrowseStamp: {
    minHeight: 152,
    paddingBottom: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    width: 180,
    height: 180,
    borderRadius: "50%",
    background: "rgba(180, 160, 140, 0.08)",
    animation: "pulse 2s ease-in-out infinite",
  },
  skeletonBrowseStamp: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    background: "linear-gradient(145deg, rgba(232, 224, 214, 0.9), rgba(200, 188, 172, 0.45))",
    animation: "pulse 2s ease-in-out infinite",
  },
};

/** Sort browse grid by ring-derived signals (count, merge spacing, band thickness variance). */
const BROWSE_SORT_OPTIONS = [
  { id: "default", label: "Default order" },
  { id: "rings_more", label: "Most rings" },
  { id: "rings_fewer", label: "Fewest rings" },
  { id: "rhythm_loose", label: "Looser rhythm" },
  { id: "rhythm_tight", label: "Tighter rhythm" },
  { id: "bands_rough", label: "Rougher bands" },
  { id: "bands_smooth", label: "Smoother bands" },
];

/** Shortcuts for browse search; values match substrings in curated display names. */
const BROWSE_QUICK_TAGS = [
  { label: "React", value: "react" },
  { label: "Next.js", value: "next" },
  { label: "Rust", value: "rust" },
  { label: "Vite", value: "vite" },
  { label: "Linux", value: "linux" },
];

const FILTER_ORDER = ["popular-repos", "frameworks", "npm-popular", "community"];

const FILTER_LABELS = {
  all: "All",
  "popular-repos": "Popular Repos",
  frameworks: "Frameworks",
  "npm-popular": "NPM Popular",
  community: "Community",
};
