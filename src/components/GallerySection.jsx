import React, { useRef, useEffect, useState, useMemo } from "react";
import TreeRingCard from "./TreeRingCard.jsx";

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
}) {
  if (!entries.length) return null;
  const [activeFilter, setActiveFilter] = useState("all");

  const filterTags = useMemo(() => {
    if (!enableFilters) return [];
    const tagSet = new Set(entries.map((entry) => entry.category || "community"));
    const ordered = FILTER_ORDER.filter((tag) => tagSet.has(tag));
    return ["all", ...ordered];
  }, [entries, enableFilters]);

  const filteredEntries = useMemo(() => {
    if (!enableFilters || activeFilter === "all") return entries;
    return entries.filter((entry) => (entry.category || "community") === activeFilter);
  }, [entries, enableFilters, activeFilter]);

  return (
    <div style={{ ...styles.section, ...(compact ? styles.sectionCompact : {}) }}>
      <div style={styles.container}>
      {showHeader && (
        <div style={{ ...styles.header, ...(compact ? styles.headerCompact : {}) }}>
          <h2 style={styles.title}>{title}</h2>
          <p style={styles.subtitle}>{subtitle}</p>
        </div>
      )}

      {enableFilters && filterTags.length > 1 && (
        <div style={styles.filtersRow}>
          {filterTags.map((tag) => (
            <button
              key={tag}
              style={{ ...styles.filterChip, ...(activeFilter === tag ? styles.filterChipActive : {}) }}
              onClick={() => setActiveFilter(tag)}
            >
              {FILTER_LABELS[tag] || tag}
            </button>
          ))}
        </div>
      )}

      <div style={{ ...styles.grid, ...(compact ? styles.gridCompact : {}) }}>
        {filteredEntries.map((entry) => (
          <LazyCard key={entry.slug} entry={entry} onSelect={onSelect} />
        ))}
      </div>
      </div>
    </div>
  );
}

function LazyCard({ entry, onSelect }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={styles.cardSlot}>
      {visible ? (
        <TreeRingCard entry={entry} onClick={() => onSelect(entry)} />
      ) : (
        <div style={styles.skeleton} />
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
    justifyContent: "flex-start",
    margin: "0 0 18px",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 18,
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
  skeleton: {
    width: 180,
    height: 180,
    borderRadius: "50%",
    background: "rgba(180, 160, 140, 0.08)",
    animation: "pulse 2s ease-in-out infinite",
  },
};

const FILTER_ORDER = ["popular-repos", "frameworks", "npm-popular", "community"];

const FILTER_LABELS = {
  all: "All",
  "popular-repos": "Popular Repos",
  frameworks: "Frameworks",
  "npm-popular": "NPM Popular",
  community: "Community",
};
