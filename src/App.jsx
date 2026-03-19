import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import TreeRing from "./TreeRing.jsx";
import GallerySection from "./components/GallerySection.jsx";
import AuthButton from "./components/AuthButton.jsx";
import PrintPanel from "./components/PrintPanel.jsx";
import { DendroCard } from "dendrochronology-visualizer/react";
import { fetchPullRequests, fetchRepoPullRequests, generateDemoData } from "./github.js";
import { seedGallery } from "./data/seedGallery.js";
import { getCache, setCache, addGalleryEntry, getGalleryEntries } from "./lib/cache.js";
import { githubPRsToRings } from "./lib/adapter.js";
import { downloadHighResPNG, exportHighResPNG } from "./lib/exportImage.js";
import {
  Sprout,
  Images,
  Printer,
  Axe,
  Droplets,
  Footprints,
  TreeDeciduous,
  Sun,
} from "lucide-react";

const GITHUB_PATH_SKIP_SECOND = new Set([
  "pull", "issues", "commits", "tree", "blob", "actions", "discussions", "settings",
  "security", "network", "releases", "tags", "wiki", "projects", "packages",
]);
const GITHUB_INVALID_USER_SEG = new Set([
  "settings", "orgs", "enterprise", "explore", "marketplace", "login", "logout", "sessions", "sponsors",
]);

/** Normalize pasted or typed GitHub references: URLs, @user, owner/repo, or username. */
function parseGithubSourceInput(raw) {
  let s = String(raw || "").trim().replace(/^[`'"“”]+|[`'"“”]+$/g, "").trim();
  if (!s) return { value: "", mode: "user" };

  const urlMatch = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^#?]*)/i);
  if (urlMatch) {
    const segments = urlMatch[1].split("/").map((p) => decodeURIComponent(p.trim())).filter(Boolean);
    if (segments.length >= 1 && GITHUB_INVALID_USER_SEG.has(segments[0].toLowerCase())) {
      /* fall through */
    } else if (segments.length >= 2 && !GITHUB_PATH_SKIP_SECOND.has(segments[1].toLowerCase())) {
      return { value: `${segments[0]}/${segments[1]}`, mode: "repo" };
    } else if (segments.length >= 1) {
      return { value: segments[0], mode: "user" };
    }
  }

  const firstLine = s.split(/\r?\n/)[0].trim();
  const text = firstLine.startsWith("@") ? firstLine.slice(1).trim() : firstLine;

  if (!/\s/.test(text) && text.includes("/")) {
    const seg = text.split("/").filter(Boolean);
    if (seg.length >= 2) {
      return { value: `${seg[0]}/${seg[1]}`, mode: "repo" };
    }
  }

  const single = text.split("/")[0].trim();
  return { value: single || text, mode: "user" };
}

/** Story beat while fetching: seedling → water → run → tree → water → sun → chop (loops). */
const GROW_LOADING_SEQUENCE = [
  Sprout,
  Droplets,
  Footprints,
  TreeDeciduous,
  Droplets,
  Sun,
  Axe,
];

const LANDING_INPUT_PLACEHOLDERS = [
  "https://github.com/vercel/next.js",
  "https://github.com/facebook/react",
  "@octocat",
  "torvalds/linux",
  "https://github.com/gndclouds",
  "rust-lang/rust",
];

const landingScrollbarHideStyles = `
  .landing-canvas-scroll::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
  @keyframes landingLlmSpin {
    to { transform: rotate(360deg); }
  }
`;

export default function App() {
  const [mode, setMode] = useState("user");
  const [inputValue, setInputValue] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [token, setToken] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [galleryEntries, setGalleryEntries] = useState([]);
  const [, setAuthenticated] = useState(false);
  const [showPrintPanel, setShowPrintPanel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hoveredStamp, setHoveredStamp] = useState(null);
  const [currentPage, setCurrentPage] = useState(() => (
    typeof window === "undefined"
      ? "home"
      : (window.location.hash === "#/browse" ? "browse" : window.location.hash === "#/create" ? "create" : "home")
  ));
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window === "undefined" ? 1200 : window.innerWidth
  ));
  const heroRef = useRef(null);
  const toolRef = useRef(null);
  const stampScrollRef = useRef(null);
  const [landingPhIndex, setLandingPhIndex] = useState(0);
  const [landingPasteFocused, setLandingPasteFocused] = useState(false);
  const [landingGrowHovered, setLandingGrowHovered] = useState(false);
  const [growLoadingIdx, setGrowLoadingIdx] = useState(0);

  // Merge seed + localStorage gallery entries
  useEffect(() => {
    const stored = getGalleryEntries();
    const allSlugs = new Set();
    const merged = [];
    // Stored entries first (community additions)
    for (const e of stored) {
      if (!allSlugs.has(e.slug)) { allSlugs.add(e.slug); merged.push(e); }
    }
    // Then seed entries
    for (const e of seedGallery) {
      if (!allSlugs.has(e.slug)) { allSlugs.add(e.slug); merged.push(e); }
    }
    setGalleryEntries(merged);
  }, []);

  // Auto-load featured tree on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Check cache first
      const cached = getCache("user:gndclouds");
      if (cached && Date.now() - cached.cachedAt < 3600000) {
        if (!cancelled) { setData(cached.data); setDisplayName("gndclouds"); setLoading(false); }
        return;
      }
      try {
        const result = await fetchPullRequests("gndclouds");
        if (!cancelled) {
          if (result.pullRequests.length > 0) {
            setData(result);
            setDisplayName("gndclouds");
            setCache("user:gndclouds", result);
          } else {
            // Empty results (rate limited) — use demo data
            setData(generateDemoData());
            setDisplayName("demo");
          }
        }
      } catch {
        if (!cancelled) { setData(generateDemoData()); setDisplayName("demo"); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const nextHash = currentPage === "browse" ? "#/browse" : (currentPage === "create" ? "#/create" : "#/");
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== "home" || inputValue || landingPasteFocused) return undefined;
    const id = window.setInterval(() => {
      setLandingPhIndex((i) => (i + 1) % LANDING_INPUT_PLACEHOLDERS.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [currentPage, inputValue, landingPasteFocused]);

  useEffect(() => {
    if (!loading) {
      setGrowLoadingIdx(0);
      return undefined;
    }
    setGrowLoadingIdx(0);
    const id = window.setInterval(() => {
      setGrowLoadingIdx((i) => (i + 1) % GROW_LOADING_SEQUENCE.length);
    }, 620);
    return () => window.clearInterval(id);
  }, [loading]);

  const loadData = useCallback(async (value, modeOverride) => {
    const useMode = modeOverride !== undefined && modeOverride !== null ? modeOverride : mode;
    setLoading(true);
    setError(null);
    setSelectedRepo(null);
    const slug = useMode === "repo" ? `repo:${value.replace("/", ":")}` : `user:${value}`;

    // Check cache
    const cached = getCache(slug);
    if (cached && Date.now() - cached.cachedAt < 3600000) {
      setData(cached.data);
      setDisplayName(value);
      setLoading(false);
      return;
    }

    try {
      let result;
      if (useMode === "repo") {
        const parts = value.split("/");
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          throw new Error('Enter a repo as "owner/repo" (e.g. facebook/react)');
        }
        result = await fetchRepoPullRequests(parts[0], parts[1], token || undefined);
        setDisplayName(value);
      } else {
        result = await fetchPullRequests(value, token || undefined);
        setDisplayName(value);
      }
      setData(result);
      // Only cache non-empty results
      if (result.pullRequests.length > 0) {
        setCache(slug, result);
      }

      // Add to gallery
      const entry = {
        slug,
        displayName: value,
        pullRequests: result.pullRequests,
      };
      addGalleryEntry({ slug, displayName: value, prCount: result.pullRequests.length });
      setGalleryEntries((prev) => {
        if (prev.find((e) => e.slug === slug)) return prev;
        return [entry, ...prev];
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, mode]);

  const onGithubPaste = useCallback((e) => {
    const text = e.clipboardData?.getData("text/plain");
    if (!text) return;
    const parsed = parseGithubSourceInput(text);
    if (parsed.value) setMode(parsed.mode);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = parseGithubSourceInput(inputValue);
    if (!parsed.value) return;
    setMode(parsed.mode);
    loadData(parsed.value, parsed.mode);
  };

  const handleGallerySelect = useCallback((entry) => {
    setData({ pullRequests: entry.pullRequests, repos: [] });
    setDisplayName(entry.displayName);
    setSelectedRepo(null);
    setCurrentPage("create");
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  }, []);

  const scrollToGallery = () => {
    setCurrentPage("browse");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const repoList = data?.repos || [];
  const pullRequests = selectedRepo
    ? (data?.pullRequests || []).filter((pr) => pr.repo === selectedRepo)
    : data?.pullRequests || [];

  const rings = useMemo(() => githubPRsToRings(pullRequests), [pullRequests]);
  const isMediumUp = viewportWidth >= 900;
  const isLargeUp = viewportWidth >= 1280;
  const chartSize = isLargeUp ? 520 : (isMediumUp ? 440 : Math.max(240, Math.min(viewportWidth - 56, 340)));
  const starterExamples = useMemo(() => seedGallery.slice(0, 6), []);
  const landingStampEntries = useMemo(() => {
    const source = seedGallery.slice(0, 10);
    return Array.from({ length: 120 }, (_, i) => {
      const entry = source[i % source.length];
      const dn = entry.displayName.trim();
      const slash = dn.indexOf("/");
      const hoverLabel = slash >= 0
        ? `@${dn.slice(0, slash)} / ${dn.slice(slash + 1)}`
        : `@${dn}`;
      return {
        id: `${entry.slug}-${i}`,
        entry,
        hoverLabel,
        rings: githubPRsToRings(entry.pullRequests),
      };
    });
  }, []);
  const landingCanvasItems = useMemo(() => {
    const columns = 9;
    const xStep = 210;
    const yStep = 210;
    const baseWidth = columns * xStep;
    const rows = Math.ceil(landingStampEntries.length / columns);
    const baseHeight = rows * yStep;
    const ringSize = Math.round(Math.min(xStep, yStep) * 0.64);

    const items = landingStampEntries.map((stamp, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const size = ringSize;
      return {
        ...stamp,
        x: col * xStep + xStep / 2,
        y: row * yStep + yStep / 2,
        size,
        rotate: 0,
      };
    });

    const tiled = [];
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (const item of items) {
          tiled.push({
            ...item,
            id: `${item.id}-${ox}-${oy}`,
            x: item.x + (ox + 1) * baseWidth,
            y: item.y + (oy + 1) * baseHeight,
          });
        }
      }
    }

    return {
      items: tiled,
      width: baseWidth * 3,
      height: baseHeight * 3,
      patternWidth: baseWidth,
      patternHeight: baseHeight,
      xStep,
      yStep,
      columns,
      rows,
      ringSize,
    };
  }, [landingStampEntries]);
  const canvasWidth = isMediumUp ? landingCanvasItems.width : Math.max(900, landingCanvasItems.width * 0.72);
  const canvasHeight = isMediumUp ? landingCanvasItems.height : Math.max(1100, landingCanvasItems.height * 0.72);

  const CTA_GRID_COLS = 3;
  const CTA_GRID_ROWS = 2;

  const canvasRenderItems = useMemo(() => {
    const { patternWidth, patternHeight, xStep, yStep, columns, rows } = landingCanvasItems;
    const centerCol = Math.floor(columns / 2);
    const ctaXInPattern = centerCol * xStep + xStep / 2;
    const rowStart = Math.max(0, Math.floor((rows - CTA_GRID_ROWS) / 2));
    const ctaYInPattern = (rowStart + 1) * yStep;
    const ctaW = CTA_GRID_COLS * xStep;
    const ctaH = CTA_GRID_ROWS * yStep;
    const ctaItem = {
      id: "cta-card",
      kind: "cta",
      x: ctaXInPattern + patternWidth,
      y: ctaYInPattern + patternHeight,
      width: ctaW,
      height: ctaH,
      rotate: 0,
    };
    const ringClearance = landingCanvasItems.ringSize * 0.48 + xStep * 0.04;
    const ctaHalfW = ctaW / 2 + ringClearance;
    const ctaHalfH = ctaH / 2 + ringClearance;
    const ringsNotUnderCta = landingCanvasItems.items.filter((item) => {
      const dx = Math.abs(item.x - ctaItem.x);
      const dy = Math.abs(item.y - ctaItem.y);
      return !(dx < ctaHalfW && dy < ctaHalfH);
    });
    return [...ringsNotUnderCta, ctaItem];
  }, [landingCanvasItems]);

  useEffect(() => {
    if (currentPage !== "home") return;
    const el = stampScrollRef.current;
    if (!el) return;
    const centerX = Math.max(0, landingCanvasItems.patternWidth + (landingCanvasItems.patternWidth - el.clientWidth) / 2);
    const centerY = Math.max(0, landingCanvasItems.patternHeight + (landingCanvasItems.patternHeight - el.clientHeight) / 2);
    el.scrollLeft = centerX;
    el.scrollTop = centerY;
  }, [currentPage, landingCanvasItems.patternWidth, landingCanvasItems.patternHeight]);

  useEffect(() => {
    if (currentPage !== "home") return;
    const el = stampScrollRef.current;
    if (!el) return;

    const wrapX = landingCanvasItems.patternWidth;
    const wrapY = landingCanvasItems.patternHeight;

    const onScroll = () => {
      if (el.scrollLeft < wrapX * 0.5) el.scrollLeft += wrapX;
      else if (el.scrollLeft > wrapX * 1.5) el.scrollLeft -= wrapX;

      if (el.scrollTop < wrapY * 0.5) el.scrollTop += wrapY;
      else if (el.scrollTop > wrapY * 1.5) el.scrollTop -= wrapY;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [currentPage, landingCanvasItems.patternWidth, landingCanvasItems.patternHeight]);

  const handleStarterSelect = useCallback((entry) => {
    const nextMode = entry.slug.startsWith("repo:") ? "repo" : "user";
    setMode(nextMode);
    setInputValue(entry.displayName);
    loadData(entry.displayName, nextMode);
  }, [loadData]);

  const handleLandingSubmit = (e) => {
    e.preventDefault();
    const parsed = parseGithubSourceInput(inputValue);
    if (!parsed.value) return;
    setMode(parsed.mode);
    setCurrentPage("create");
    loadData(parsed.value, parsed.mode);
  };

  const handleDownload = async () => {
    if (!rings.length) return;
    setExporting(true);
    try {
      await downloadHighResPNG(rings, {}, displayName, displayName.replace(/\//g, "-"));
    } finally {
      setExporting(false);
    }
  };

  const handlePrintOrder = async ({ size, paper, total }) => {
    if (!rings.length) return;
    // 1. Export high-res PNG
    const blob = await exportHighResPNG(rings, {}, displayName);
    // 2. Upload to Vercel Blob
    const uploadRes = await fetch("/api/print/upload-image", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: blob,
    });
    if (!uploadRes.ok) throw new Error("Failed to upload image");
    const { url: imageUrl } = await uploadRes.json();
    // 3. Create Stripe checkout
    const checkoutRes = await fetch("/api/print/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ size, paper, total, imageUrl, displayName }),
    });
    if (!checkoutRes.ok) throw new Error("Failed to create checkout");
    const { url } = await checkoutRes.json();
    // 4. Redirect to Stripe
    window.location.href = url;
  };

  const GrowLoadingIcon = GROW_LOADING_SEQUENCE[growLoadingIdx];

  return (
    <div style={styles.page}>
      <style>{landingScrollbarHideStyles}</style>
      {currentPage === "browse" ? (
        <section style={styles.browsePage}>
          <div style={styles.browseTopBar}>
            <div style={styles.navTitle}>Dendrocode</div>
            <div style={styles.navLinks}>
              <button style={styles.navLinkBtn} onClick={() => setCurrentPage("create")}>Create</button>
            </div>
          </div>
          <div style={styles.galleryLead}>
            <h2 style={styles.galleryTitle}>Browse Gallery</h2>
            <p style={styles.gallerySub}>Explore curated examples, then load one into the tool.</p>
          </div>
          <GallerySection
            entries={galleryEntries}
            onSelect={handleGallerySelect}
            enableFilters={true}
            showHeader={false}
          />
        </section>
      ) : currentPage === "create" ? (
      <section ref={toolRef} style={styles.toolSection}>
        <div style={styles.browseTopBar}>
          <div style={styles.navTitle}>Dendrocode</div>
          <div style={styles.navLinks}>
            <button style={styles.navLinkBtn} onClick={() => setCurrentPage("home")}>Home</button>
            <button style={styles.navLinkBtn} onClick={() => setCurrentPage("browse")}>Browse</button>
          </div>
        </div>

        <div style={styles.toolSectionHeader}>
          <div>
            <h2 style={styles.toolTitle}>Create</h2>
            <p style={styles.toolSub}>
              {displayName && displayName !== "demo"
                ? `${displayName}${selectedRepo ? ` / ${selectedRepo}` : ""}`
                : "Enter a username or repo to generate your tree ring."}
            </p>
          </div>
          <div style={styles.topRightActions}>
            <AuthButton onAuthChange={setAuthenticated} />
            {pullRequests.length > 0 && displayName !== "demo" && (
              <>
                <button
                  style={styles.ctaBtn}
                  onClick={handleDownload}
                  disabled={exporting}
                >
                  {exporting ? "Exporting..." : "Download PNG"}
                </button>
                <button
                  style={{ ...styles.ctaBtn, background: "#6a5a48", color: "#f5f0eb", borderColor: "#6a5a48" }}
                  onClick={() => setShowPrintPanel(true)}
                >
                  Order Print
                </button>
              </>
            )}
          </div>
        </div>

        <div style={styles.controlsCard}>
          {error && <p style={styles.error}>{error}</p>}

          <div style={styles.modeToggle}>
            <button
              style={{ ...styles.modeBtn, ...(mode === "user" ? styles.modeBtnActive : {}) }}
              onClick={() => { setMode("user"); setInputValue("octocat"); }}
            >User</button>
            <button
              style={{ ...styles.modeBtn, ...(mode === "repo" ? styles.modeBtnActive : {}) }}
              onClick={() => { setMode("repo"); setInputValue("facebook/react"); }}
            >Repo</button>
          </div>

          <form onSubmit={handleSubmit} style={{ ...styles.form, ...(isMediumUp ? null : styles.formMobile) }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPaste={onGithubPaste}
              placeholder="GitHub URL, @user, or owner/repo"
              style={{ ...styles.input, ...(isMediumUp ? null : styles.inputMobile) }}
            />
            <button
              type="submit"
              style={{ ...styles.enterBtn, ...(loading ? styles.enterBtnLoading : null) }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span key={growLoadingIdx} style={styles.llmGrowLoadStep} aria-hidden>
                    <GrowLoadingIcon size={18} strokeWidth={2} />
                  </span>
                  Generating...
                </>
              ) : (
                "Generate Tree Ring"
              )}
            </button>
          </form>

          <div style={styles.secondaryActions}>
            <details style={styles.advancedDetails}>
              <summary style={styles.tokenToggle}>Advanced (token)</summary>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
                style={{ ...styles.input, width: 220, marginTop: 8, fontSize: 12 }}
              />
            </details>
          </div>

          <div style={styles.starterRow}>
            {starterExamples.map((entry) => (
              <button
                key={entry.slug}
                style={styles.starterChip}
                onClick={() => handleStarterSelect(entry)}
              >
                Try {entry.displayName}
              </button>
            ))}
          </div>

          {displayName === "demo" && (
            <p style={styles.demoHint}>Demo data is showing. Enter a username or repo for live data.</p>
          )}
        </div>

        {repoList.length > 1 && displayName !== "demo" && (
          <div style={styles.repoRow}>
            <button
              style={{ ...styles.chip, ...(selectedRepo === null ? styles.chipActive : {}) }}
              onClick={() => setSelectedRepo(null)}
            >All</button>
            {repoList.map((repo) => (
              <button
                key={repo.name}
                style={{ ...styles.chip, ...(selectedRepo === repo.name ? styles.chipActive : {}) }}
                onClick={() => setSelectedRepo(repo.name)}
              >{repo.name}</button>
            ))}
          </div>
        )}

        <div style={styles.vizArea}>
          {data && <TreeRing pullRequests={pullRequests} username={displayName} repoName={selectedRepo} size={chartSize} />}
          {loading && <div style={styles.loadingOverlay}>Loading...</div>}
        </div>
        <div style={styles.infoArea}>
          <span>{pullRequests.length} pull request{pullRequests.length !== 1 ? "s" : ""}</span>
          <span style={styles.infoDivider}>·</span>
          <span>width = files</span>
          <span style={styles.infoDivider}>·</span>
          <span>texture = commits</span>
        </div>
      </section>
      ) : (
      <>
      <section ref={heroRef} style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={styles.stampStage}>
            <div ref={stampScrollRef} className="landing-canvas-scroll" style={styles.stampGridScroll}>
              <div
                style={{
                  ...styles.canvasSurface,
                  width: canvasWidth,
                  height: canvasHeight,
                }}
              >
                {canvasRenderItems.map((item) => {
                  const isCta = item.kind === "cta";
                  const size = isCta ? 0 : (isMediumUp ? item.size : Math.max(52, Math.round(item.size * 0.78)));
                  const isHovered = !isCta && hoveredStamp === item.id;
                  const ctaW = isCta && item.width != null
                    ? (isMediumUp ? item.width : Math.round(item.width * 0.75))
                    : undefined;
                  const ctaH = isCta && item.height != null
                    ? (isMediumUp ? item.height : Math.round(item.height * 0.85))
                    : undefined;
                  return (
                    <div
                      key={item.id}
                      style={{
                        ...styles.stampWrap,
                        ...(isCta ? styles.ctaCellBackdrop : null),
                        left: isMediumUp ? item.x : Math.round(item.x * 0.75),
                        top: isMediumUp ? item.y : Math.round(item.y * 0.85),
                        width: ctaW,
                        height: ctaH,
                        transform: `translate(-50%, -50%) rotate(${item.rotate || 0}deg)`,
                        zIndex: isCta ? 4 : 1,
                      }}
                      onMouseEnter={() => { if (!isCta) setHoveredStamp(item.id); }}
                      onMouseLeave={() => { if (!isCta) setHoveredStamp(null); }}
                    >
                      {isCta ? (
                        <div style={{ ...styles.centerCtaCard, ...styles.centerCtaCardGrid, ...styles.llmPromptCard }}>
                          <div style={styles.llmPromptCardHeader}>
                            <div style={styles.llmDictHead}>
                              <h2 style={styles.llmPromptTitle}>Dendrocode</h2>
                              <p style={styles.llmPromptTagline}>Tree ring generator</p>
                              <p style={styles.llmPronunciation}>
                                <span style={styles.llmIpa}>/DEN-droh-kohd/</span>
                                <span style={styles.llmDictMidDot}> · </span>
                                <abbr title="noun" style={styles.llmPartOfSpeech}>n.</abbr>
                              </p>
                            </div>
                            <p style={styles.llmDefinition}>
                              <span style={styles.llmDefNum}>1.</span> A generator that draws concentric rings from
                              GitHub pull-request history—each band a span of collaboration—by analogy to{" "}
                              <strong style={styles.llmPromptStrong}>dendrochronology</strong>, the science of reading
                              past seasons and climates from the growth rings of trees.
                            </p>
                            <p style={{ ...styles.llmDefinition, marginBottom: 2 }}>
                              <span style={styles.llmDefNum}>2.</span>
                              <Images size={15} strokeWidth={1.75} style={styles.llmInlineIcon} aria-hidden />
                              <button
                                type="button"
                                style={styles.llmInlineGalleryBtn}
                                onClick={scrollToGallery}
                              >
                                Browse the gallery
                              </button>{" "}
                              for curated examples.
                              <Sprout size={15} strokeWidth={1.75} style={styles.llmInlineIconAfter} aria-hidden />
                              Paste a URL, @handle, or owner/repo below to grow your own.
                              <Printer size={15} strokeWidth={1.75} style={styles.llmInlineIconAfter} aria-hidden />
                              When a ring feels right, order a print and keep it on your wall.
                            </p>
                          </div>
                          <form onSubmit={handleLandingSubmit} style={styles.llmPromptForm}>
                            <div style={styles.llmPromptPasteArea}>
                              <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onPaste={onGithubPaste}
                                onFocus={() => setLandingPasteFocused(true)}
                                onBlur={() => setLandingPasteFocused(false)}
                                placeholder={LANDING_INPUT_PLACEHOLDERS[landingPhIndex]}
                                autoComplete="off"
                                aria-label="GitHub URL, @username, or owner/repo"
                                style={styles.llmPromptInput}
                              />
                              <button
                                type="submit"
                                style={{
                                  ...styles.llmPromptSubmit,
                                  ...(!inputValue.trim() && !loading ? styles.llmPromptSubmitIdle : null),
                                }}
                                disabled={loading || !inputValue.trim()}
                                aria-label={loading ? "Growing your tree ring" : "Grow tree ring from GitHub"}
                                onMouseEnter={() => setLandingGrowHovered(true)}
                                onMouseLeave={() => setLandingGrowHovered(false)}
                              >
                                {loading ? (
                                  <span key={growLoadingIdx} style={styles.llmGrowLoadStep} aria-hidden>
                                    <GrowLoadingIcon size={19} strokeWidth={2} />
                                  </span>
                                ) : landingGrowHovered ? (
                                  <Axe size={19} strokeWidth={2} aria-hidden />
                                ) : (
                                  <Sprout size={19} strokeWidth={2} aria-hidden />
                                )}
                              </button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <div style={{ ...styles.stampCard, ...(isHovered ? styles.stampCardHover : null) }}>
                          <DendroCard rings={item.rings} size={size} />
                          <div style={{ ...styles.stampMeta, ...(isHovered ? styles.stampMetaVisible : null) }}>
                            <div style={styles.stampMetaLine}>{item.hoverLabel}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </section>

      </>
      )}

      {/* Print Panel Modal */}
      {showPrintPanel && (
        <PrintPanel
          onClose={() => setShowPrintPanel(false)}
          onOrder={handlePrintOrder}
          displayName={displayName}
        />
      )}

      <footer style={styles.siteCredit} aria-label="Credit">
        Made by{" "}
        <a href="https://tinyfactories.co" target="_blank" rel="noopener noreferrer" style={styles.siteCreditLink}>
          tiny factories
        </a>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    width: "100%",
    minHeight: "100vh",
    background: "#f5f0eb",
    position: "relative",
  },
  siteCredit: {
    position: "fixed",
    left: 16,
    bottom: 16,
    zIndex: 100,
    margin: 0,
    fontSize: 12,
    lineHeight: 1.35,
    color: "rgba(58, 48, 40, 0.62)",
    fontFamily: "inherit",
    pointerEvents: "auto",
  },
  siteCreditLink: {
    color: "inherit",
    fontWeight: 600,
    textDecoration: "underline",
    textDecorationColor: "rgba(58, 48, 40, 0.35)",
    textUnderlineOffset: 3,
  },
  hero: {
    width: "100%",
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 0,
    position: "relative",
  },
  browsePage: {
    minHeight: "100vh",
    paddingTop: 18,
  },
  browseTopBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    maxWidth: 1240,
    margin: "0 auto",
  },
  navTitle: {
    fontSize: 12,
    color: "#3a3028",
  },
  navLinks: {
    display: "flex",
    gap: 18,
    alignItems: "center",
  },
  navLinkBtn: {
    border: "none",
    background: "none",
    cursor: "pointer",
    fontSize: 12,
    color: "#3a3028",
    fontFamily: "inherit",
    padding: 0,
  },
  heroInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 0,
    width: "100%",
    height: "100vh",
  },
  stampStage: {
    position: "relative",
    minHeight: "100vh",
    height: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: "#f5f0eb",
  },
  stampGridScroll: {
    width: "100%",
    height: "100%",
    minHeight: "100vh",
    maxHeight: "100vh",
    overflow: "auto",
    padding: 18,
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  canvasSurface: {
    position: "relative",
  },
  stampWrap: {
    position: "absolute",
    transformOrigin: "center center",
  },
  ctaCellBackdrop: {
    background: "#f5f0eb",
    borderRadius: 0,
  },
  stampCard: {
    position: "relative",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    padding: 0,
    transition: "transform 0.2s ease",
  },
  stampCardHover: {
    transform: "translateY(-2px) scale(1.03)",
    zIndex: 3,
  },
  stampMeta: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: -40,
    minWidth: 120,
    background: "rgba(255,255,255,0.95)",
    color: "#5d4f42",
    border: "1px solid #d8cab9",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 11,
    lineHeight: 1.2,
    opacity: 0,
    pointerEvents: "none",
    transition: "opacity 0.15s ease",
  },
  stampMetaVisible: {
    opacity: 1,
  },
  stampMetaLine: {
    whiteSpace: "nowrap",
  },
  centerCtaCard: {
    width: "min(540px, calc(100% - 48px))",
    background: "#f5f0eb",
    border: "1px solid #e0d4c5",
    borderRadius: 16,
    padding: "22px 18px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    zIndex: 2,
    pointerEvents: "auto",
  },
  centerCtaCardGrid: {
    width: "100%",
    height: "100%",
    maxWidth: "none",
    minHeight: 0,
    boxSizing: "border-box",
    justifyContent: "center",
    alignItems: "stretch",
    padding: "8px 10px",
    gap: 6,
  },
  llmPromptCard: {
    background: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: 0,
    boxShadow: "none",
    gap: 8,
    padding: "12px 14px 6px",
    justifyContent: "flex-start",
  },
  llmPromptCardHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 0,
    width: "100%",
    textAlign: "left",
  },
  llmDictHead: {
    marginBottom: 8,
    borderBottom: "1px solid #e4e4e7",
    paddingBottom: 8,
    width: "100%",
  },
  llmPromptTagline: {
    margin: 0,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 500,
    color: "#71717a",
    letterSpacing: "0.02em",
  },
  llmPromptTitle: {
    margin: 0,
    marginBottom: 4,
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "#18181b",
    lineHeight: 1.12,
    fontFamily: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  },
  llmPronunciation: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.35,
    color: "#52525b",
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  llmIpa: {
    letterSpacing: "0.04em",
  },
  llmDictMidDot: {
    color: "#a1a1aa",
    fontFamily: "inherit",
  },
  llmPartOfSpeech: {
    fontStyle: "italic",
    textDecoration: "none",
    fontWeight: 500,
    color: "#71717a",
    fontFamily: "Georgia, ui-serif, serif",
  },
  llmDefinition: {
    margin: 0,
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 1.6,
    color: "#3f3f46",
  },
  llmDefNum: {
    fontWeight: 700,
    color: "#71717a",
    marginRight: 6,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: 13,
  },
  llmInlineIcon: {
    display: "inline-block",
    verticalAlign: "-0.2em",
    marginRight: 5,
    marginLeft: 2,
    color: "#6a5a48",
    flexShrink: 0,
  },
  llmInlineIconAfter: {
    display: "inline-block",
    verticalAlign: "-0.2em",
    marginLeft: 8,
    marginRight: 5,
    color: "#6a5a48",
    flexShrink: 0,
  },
  llmPromptStrong: {
    fontWeight: 600,
    color: "#27272a",
  },
  llmInlineGalleryBtn: {
    border: "none",
    background: "none",
    cursor: "pointer",
    color: "#2d6a4f",
    fontWeight: 600,
    font: "inherit",
    fontSize: "inherit",
    padding: 0,
    textDecoration: "underline",
    textUnderlineOffset: 3,
    textDecorationColor: "rgba(45, 106, 79, 0.45)",
    display: "inline",
  },
  llmPromptForm: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    margin: 0,
    marginTop: 0,
  },
  llmPromptPasteArea: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    background: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: 0,
    padding: "8px 10px 8px 12px",
    boxSizing: "border-box",
    minHeight: 52,
    width: "100%",
  },
  llmPromptInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 16,
    lineHeight: 1.45,
    color: "#18181b",
    fontFamily: "inherit",
    padding: "6px 4px",
  },
  llmPromptSubmit: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 0,
    border: "1px solid rgba(45, 106, 79, 0.45)",
    background: "linear-gradient(160deg, #3d8f69 0%, #2d6a4f 55%, #256955 100%)",
    color: "#f5faf7",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    boxShadow: "none",
    transition: "opacity 0.15s ease, transform 0.15s ease",
  },
  llmPromptSubmitIdle: {
    opacity: 0.38,
    cursor: "not-allowed",
  },
  llmGrowLoadStep: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "growLoadStep 0.48s ease-out forwards",
  },
  controlsCard: {
    width: "100%",
    maxWidth: 980,
    background: "rgba(255,255,255,0.75)",
    border: "1px solid #dfd3c4",
    borderRadius: 16,
    padding: "16px 16px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  modeToggle: {
    display: "flex",
    gap: 0,
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid #d4c8b8",
    width: "fit-content",
  },
  modeBtn: {
    padding: "5px 14px",
    fontSize: 12,
    border: "none",
    background: "rgba(255, 255, 255, 0.4)",
    color: "#8a7a68",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 400,
  },
  modeBtnActive: {
    background: "#6a5a48",
    color: "#f5f0eb",
    fontWeight: 500,
  },
  form: {
    display: "flex",
    gap: 6,
    width: "100%",
    justifyContent: "center",
  },
  formMobile: {
    flexDirection: "column",
    alignItems: "stretch",
  },
  input: {
    padding: "10px 12px",
    fontSize: 15,
    borderRadius: 8,
    border: "1px solid #d4c8b8",
    background: "#ffffff",
    color: "#3a3028",
    outline: "none",
    width: 300,
    maxWidth: "100%",
    fontFamily: "inherit",
  },
  inputMobile: {
    width: "100%",
  },
  enterBtn: {
    padding: "10px 16px",
    fontSize: 14,
    borderRadius: 8,
    border: "1px solid #6a5a48",
    background: "#6a5a48",
    color: "#f5f0eb",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 500,
  },
  enterBtnLoading: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActions: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  tokenToggle: {
    background: "none",
    border: "none",
    color: "#b0a090",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
    fontFamily: "inherit",
    padding: 0,
  },
  advancedDetails: {
    marginTop: 2,
  },
  starterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  starterChip: {
    border: "1px solid #d4c8b8",
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 11,
    background: "rgba(255,255,255,0.7)",
    color: "#7d6d5d",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  error: {
    color: "#c45a3a",
    fontSize: 13,
    margin: 0,
  },
  repoRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 8,
  },
  chip: {
    padding: "4px 10px",
    fontSize: 11,
    borderRadius: 12,
    border: "1px solid #d4c8b8",
    background: "rgba(255, 255, 255, 0.5)",
    color: "#8a7a68",
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: "blur(8px)",
  },
  chipActive: {
    background: "#6a5a48",
    borderColor: "#6a5a48",
    color: "#f5f0eb",
  },
  toolSection: {
    maxWidth: 1240,
    margin: "0 auto",
    padding: "8px 24px 24px",
  },
  hiddenToolSection: {
    display: "none",
  },
  toolSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  toolTitle: {
    margin: 0,
    color: "#6a5a48",
    fontSize: 24,
    fontWeight: 500,
  },
  toolSub: {
    margin: "6px 0 0",
    color: "#9f8f7f",
    fontSize: 14,
  },
  topRightActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  ctaBtn: {
    padding: "8px 20px",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid #c4b8a8",
    background: "rgba(255, 255, 255, 0.7)",
    color: "#6a5a48",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 400,
  },
  vizArea: {
    minHeight: 300,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    zIndex: 1,
    background: "rgba(255,255,255,0.6)",
    border: "1px solid #dfd3c4",
    borderRadius: 12,
    padding: "16px 10px",
    overflow: "hidden",
  },
  loadingOverlay: {
    position: "absolute",
    fontSize: 14,
    color: "#998877",
    fontWeight: 300,
    letterSpacing: 2,
  },
  demoHint: {
    fontSize: 11,
    color: "#b0a090",
    margin: 0,
    fontStyle: "italic",
  },
  infoArea: {
    marginTop: 14,
    fontSize: 11,
    color: "#b0a090",
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    fontWeight: 300,
  },
  infoDivider: {
    color: "#ccc0b0",
  },
  galleryLead: {
    maxWidth: 1240,
    margin: "0 auto",
    padding: "36px 24px 0",
  },
  galleryTitle: {
    margin: 0,
    color: "#6a5a48",
    fontSize: 24,
    fontWeight: 500,
  },
  gallerySub: {
    margin: "8px 0 14px",
    color: "#9f8f7f",
    fontSize: 14,
  },
};
