import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import TreeRing from "./TreeRing.jsx";
import GallerySection from "./components/GallerySection.jsx";
import AuthButton from "./components/AuthButton.jsx";
import PrintPanel from "./components/PrintPanel.jsx";
import LazyDendroStamp from "./components/LazyDendroStamp.jsx";
import { generateDemoData } from "./github.js";
import { seedGallery } from "./data/seedGallery.js";
import { getCache, setCache, addGalleryEntry, getGalleryEntries } from "./lib/cache.js";
import { mergeGallerySources } from "./lib/galleryMerge.js";
import { fetchTreeData, fetchReleaseForRepo } from "./lib/api.js";
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
  CircleUser,
} from "lucide-react";

/** Browse / Create / Account top bar: Sign in link, or account icon when authenticated. */
function TopBarNavAuth({ authenticated, currentPage, setCurrentPage, styles: navStyles }) {
  const returnTo =
    currentPage === "browse" ? "browse"
      : currentPage === "create" ? "create"
        : currentPage === "account" ? "account"
          : "home";
  const loginHref = `/api/auth/login?return=${encodeURIComponent(returnTo)}`;

  if (!authenticated) {
    return (
      <a href={loginHref} style={navStyles.navSignIn}>
        Sign in
      </a>
    );
  }

  return (
    <button
      type="button"
      style={{
        ...navStyles.navAccountIconBtn,
        ...(currentPage === "account" ? navStyles.navAccountIconBtnActive : null),
      }}
      onClick={() => setCurrentPage("account")}
      aria-label="Account"
      title="Account"
    >
      <CircleUser size={22} strokeWidth={1.75} aria-hidden />
    </button>
  );
}

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
  const [inputValue, setInputValue] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [token, setToken] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [galleryEntries, setGalleryEntries] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [showPrintPanel, setShowPrintPanel] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hoveredStamp, setHoveredStamp] = useState(null);
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window === "undefined") return "home";
    const h = window.location.hash;
    if (h === "#/browse") return "browse";
    if (h === "#/create") return "create";
    if (h === "#/account") return "account";
    return "home";
  });
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window === "undefined" ? 1200 : window.innerWidth
  ));
  const heroRef = useRef(null);
  const toolRef = useRef(null);
  const stampScrollRef = useRef(null);
  const [landingPhIndex, setLandingPhIndex] = useState(0);
  const [landingPasteFocused, setLandingPasteFocused] = useState(false);
  const [landingGrowHovered, setLandingGrowHovered] = useState(false);
  const [createGrowHovered, setCreateGrowHovered] = useState(false);
  const [growLoadingIdx, setGrowLoadingIdx] = useState(0);
  const [footerPrintTitle, setFooterPrintTitle] = useState(true);
  const [footerPrintOrgRepo, setFooterPrintOrgRepo] = useState(false);
  const [footerPrintReleaseTag, setFooterPrintReleaseTag] = useState(false);
  const [releaseFetchState, setReleaseFetchState] = useState("idle");
  const [releaseDetail, setReleaseDetail] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState(null);
  const [shareToBrowse, setShareToBrowse] = useState(false);
  const [accountEntries, setAccountEntries] = useState([]);
  const [accountLoading, setAccountLoading] = useState(false);

  const refreshGallery = useCallback(async () => {
    const stored = getGalleryEntries();
    let server = [];
    try {
      const r = await fetch("/api/gallery?limit=50", { credentials: "include" });
      if (r.ok) {
        const j = await r.json();
        server = j.entries || [];
      }
    } catch {
      /* offline or no KV */
    }
    setGalleryEntries(mergeGallerySources(server, stored, seedGallery));
  }, []);

  const refreshAccountGallery = useCallback(async () => {
    setAccountLoading(true);
    try {
      const r = await fetch("/api/account/gallery", { credentials: "include" });
      if (r.status === 401) {
        setAccountEntries([]);
        return;
      }
      const j = r.ok ? await r.json() : { entries: [] };
      setAccountEntries(j.entries || []);
    } catch {
      setAccountEntries([]);
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentPage !== "browse") return;
    void refreshGallery();
  }, [currentPage, refreshGallery]);

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
        const result = await fetchTreeData("user", "gndclouds", undefined);
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
    const nextHash =
      currentPage === "browse"
        ? "#/browse"
        : currentPage === "create"
          ? "#/create"
          : currentPage === "account"
            ? "#/account"
            : "#/";
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== "account" || !authenticated) return;
    void refreshAccountGallery();
  }, [currentPage, authenticated, refreshAccountGallery]);

  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash;
      const p =
        h === "#/browse" ? "browse" : h === "#/create" ? "create" : h === "#/account" ? "account" : "home";
      setCurrentPage((cur) => (cur === p ? cur : p));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
    const parsed = parseGithubSourceInput(value);
    const clean = parsed.value || String(value || "").trim();
    if (!clean) return;

    const useMode = modeOverride !== undefined && modeOverride !== null ? modeOverride : parsed.mode;
    setLoading(true);
    setError(null);
    setSelectedRepo(null);
    const slug = useMode === "repo" ? `repo:${clean.replace("/", ":")}` : `user:${clean}`;

    // Check cache
    const cached = getCache(slug);
    if (cached && Date.now() - cached.cachedAt < 3600000) {
      setData(cached.data);
      setDisplayName(clean);
      setLoading(false);
      return;
    }

    try {
      let result;
      if (useMode === "repo") {
        const parts = clean.split("/");
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          throw new Error('Enter a repo as "owner/repo" (e.g. facebook/react)');
        }
        result = await fetchTreeData("repo", clean, token || undefined);
        setDisplayName(clean);
      } else {
        result = await fetchTreeData("user", clean, token || undefined);
        setDisplayName(clean);
      }
      setData(result);
      // Only cache non-empty results
      if (result.pullRequests.length > 0) {
        setCache(slug, result);
      }

      // Add to gallery
      const entry = {
        slug,
        displayName: clean,
        pullRequests: result.pullRequests,
      };
      addGalleryEntry({ slug, displayName: clean, prCount: result.pullRequests.length });
      setGalleryEntries((prev) => {
        if (prev.find((e) => e.slug === slug)) return prev;
        return [entry, ...prev];
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const parsed = parseGithubSourceInput(inputValue);
    if (!parsed.value) return;
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

  const repoList = useMemo(() => {
    const fromData = data?.repos || [];
    if (fromData.length) return fromData;
    const map = {};
    for (const pr of data?.pullRequests || []) {
      if (!map[pr.repo]) map[pr.repo] = { name: pr.repo, count: 0 };
      map[pr.repo].count++;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [data?.repos, data?.pullRequests]);
  const pullRequests = selectedRepo
    ? (data?.pullRequests || []).filter((pr) => pr.repo === selectedRepo)
    : data?.pullRequests || [];

  const rings = useMemo(() => githubPRsToRings(pullRequests), [pullRequests]);
  const hasRingData = pullRequests.length > 0;
  const canExport = hasRingData && displayName !== "demo";

  const currentGallerySlug = useMemo(() => {
    if (!canExport) return null;
    const dn = displayName.trim();
    if (dn.includes("/")) return `repo:${dn.replace("/", ":")}`;
    return `user:${dn}`;
  }, [canExport, displayName]);

  const creditTarget = useMemo(() => {
    if (!canExport) return null;
    const dn = displayName.trim();
    if (dn.includes("/")) {
      const [o, r] = dn.split("/").map((s) => s.trim()).filter(Boolean);
      if (o && r) return { owner: o, repo: r };
    }
    const repo = selectedRepo || repoList[0]?.name;
    if (!repo) return null;
    return { owner: dn, repo };
  }, [canExport, displayName, selectedRepo, repoList]);

  const printFooter = useMemo(() => {
    const title = footerPrintTitle && displayName.trim() ? displayName.trim() : "";
    const orgRepo =
      footerPrintOrgRepo && creditTarget
        ? `${creditTarget.owner} / ${creditTarget.repo}`
        : "";
    let releaseTag = "";
    if (footerPrintReleaseTag && creditTarget) {
      if (releaseFetchState === "done" && releaseDetail) {
        releaseTag = releaseDetail.tagName || releaseDetail.name || "";
      }
    }
    return { title, orgRepo, releaseTag };
  }, [
    footerPrintTitle,
    footerPrintOrgRepo,
    footerPrintReleaseTag,
    displayName,
    creditTarget,
    releaseFetchState,
    releaseDetail,
  ]);

  useEffect(() => {
    if (!footerPrintReleaseTag || !creditTarget) {
      setReleaseFetchState("idle");
      setReleaseDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setReleaseFetchState("loading");
      setReleaseDetail(null);
      try {
        const out = await fetchReleaseForRepo(creditTarget.owner, creditTarget.repo, token || undefined);
        if (cancelled) return;
        if (!out.ok) {
          setReleaseFetchState("error");
          setReleaseDetail(null);
        } else if (!out.release) {
          setReleaseFetchState("none");
          setReleaseDetail(null);
        } else {
          setReleaseFetchState("done");
          setReleaseDetail(out.release);
        }
      } catch {
        if (!cancelled) {
          setReleaseFetchState("error");
          setReleaseDetail(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [footerPrintReleaseTag, creditTarget, token]);

  useEffect(() => {
    setShareMessage(null);
    setShareToBrowse(false);
  }, [currentGallerySlug, displayName]);

  const toggleShareToBrowse = useCallback(
    async (checked) => {
      if (!currentGallerySlug || !pullRequests.length || !authenticated) return;
      setShareBusy(true);
      setShareMessage(null);
      try {
        if (!checked) {
          const res = await fetch("/api/gallery/unshare", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: currentGallerySlug }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(j.error || `Unshare failed (${res.status})`);
          }
          setShareToBrowse(false);
          setShareMessage("Removed from the Browse gallery.");
          await refreshGallery();
          return;
        }
        const res = await fetch("/api/gallery/share", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: currentGallerySlug,
            displayName: displayName.trim(),
            pullRequests,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(j.error || `Share failed (${res.status})`);
        }
        addGalleryEntry({
          slug: currentGallerySlug,
          displayName: displayName.trim(),
          prCount: pullRequests.length,
        });
        setShareToBrowse(true);
        setShareMessage("Published — open Browse to see it in the gallery.");
        await refreshGallery();
      } catch (e) {
        setShareMessage(`Error — ${e.message || "request failed"}`);
      } finally {
        setShareBusy(false);
      }
    },
    [
      authenticated,
      currentGallerySlug,
      displayName,
      pullRequests,
      refreshGallery,
    ],
  );

  const handleAccountEntryOpen = useCallback((entry) => {
    setData({ pullRequests: entry.pullRequests, repos: [] });
    setDisplayName(entry.displayName);
    setSelectedRepo(null);
    setCurrentPage("create");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }, []);

  const handleAccountOrderPrint = useCallback((entry) => {
    setData({ pullRequests: entry.pullRequests, repos: [] });
    setDisplayName(entry.displayName);
    setSelectedRepo(null);
    setCurrentPage("create");
    setShowPrintPanel(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }, []);

  const handleAccountUnshare = useCallback(
    async (slug) => {
      setShareBusy(true);
      try {
        const res = await fetch("/api/gallery/unshare", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(j.error || `Unshare failed (${res.status})`);
        }
        await refreshAccountGallery();
        await refreshGallery();
      } catch (e) {
        setShareMessage(`Error — ${e.message || "could not remove"}`);
      } finally {
        setShareBusy(false);
      }
    },
    [refreshAccountGallery, refreshGallery],
  );

  const isMediumUp = viewportWidth >= 900;
  const isLargeUp = viewportWidth >= 1280;
  const chartSize = isLargeUp ? 520 : (isMediumUp ? 440 : Math.max(240, Math.min(viewportWidth - 56, 340)));
  const starterExamples = useMemo(() => seedGallery.slice(0, 6), []);
  const landingStampEntries = useMemo(() => {
    const source = seedGallery.slice(0, 10);
    const ringsBySlug = Object.fromEntries(
      source.map((e) => [e.slug, githubPRsToRings(e.pullRequests)]),
    );
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
        rings: ringsBySlug[entry.slug],
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
    setInputValue(entry.displayName);
    loadData(entry.displayName);
  }, [loadData]);

  const handleLandingSubmit = (e) => {
    e.preventDefault();
    const parsed = parseGithubSourceInput(inputValue);
    if (!parsed.value) return;
    setCurrentPage("create");
    loadData(parsed.value, parsed.mode);
  };

  const handleDownload = async () => {
    if (!rings.length) return;
    setExporting(true);
    try {
      await downloadHighResPNG(rings, {}, printFooter, displayName.replace(/\//g, "-"));
    } finally {
      setExporting(false);
    }
  };

  const handlePrintOrder = async ({ size, paper, total }) => {
    if (!rings.length) return;
    const blob = await exportHighResPNG(rings, {}, printFooter);
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
            <button type="button" style={styles.navTitleBtn} onClick={() => setCurrentPage("home")}>
              Dendrocode
            </button>
            <div style={styles.navLinks}>
              <button type="button" style={styles.navLinkBtn} onClick={() => setCurrentPage("create")}>Create</button>
              <button type="button" style={styles.navLinkBtn} onClick={() => setCurrentPage("browse")}>Browse</button>
              <TopBarNavAuth
                authenticated={authenticated}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                styles={styles}
              />
            </div>
          </div>
          <div style={styles.galleryLead}>
            <h2 style={styles.galleryTitle}>Browse Gallery</h2>
            <p style={styles.gallerySub}>Curated examples, community shares, and your local recents—open one in Create.</p>
          </div>
          <GallerySection
            entries={galleryEntries}
            onSelect={handleGallerySelect}
            enableFilters={true}
            showHeader={false}
            nameOnly
          />
        </section>
      ) : currentPage === "create" ? (
      <section ref={toolRef} style={styles.toolSection}>
        <div style={styles.browseTopBarTool}>
          <button type="button" style={styles.navTitleBtn} onClick={() => setCurrentPage("home")}>
            Dendrocode
          </button>
          <div style={styles.navLinks}>
            <button type="button" style={styles.navLinkBtn} onClick={() => setCurrentPage("create")}>Create</button>
            <button type="button" style={styles.navLinkBtn} onClick={() => setCurrentPage("browse")}>Browse</button>
            <TopBarNavAuth
              authenticated={authenticated}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              styles={styles}
            />
          </div>
        </div>

        <div style={styles.createWorkspace}>
          <div style={styles.createLeft}>
            <div style={styles.createIntro}>
              <h2 style={styles.createPageTitle}>Create</h2>
              <p style={styles.createPageSub}>
                {displayName && displayName !== "demo"
                  ? `Showing ${displayName}${selectedRepo ? ` · ${selectedRepo}` : ""}.`
                  : "Link or example, preview the ring, then download or print."}
              </p>
            </div>

            <div style={styles.createPanelCard}>
              {error && <p style={styles.error}>{error}</p>}

              <div style={styles.createStep}>
                <div style={styles.createStepHead}>
                  <span style={styles.createStepBadge}>1</span>
                  <h3 style={styles.createStepTitle}>GitHub URL or example</h3>
                </div>
                <p style={styles.createStepHint}>
                  Paste a URL, <code style={styles.createStepCode}>@user</code>, or{" "}
                  <code style={styles.createStepCode}>owner/repo</code>—or tap a starter.
                </p>
                <form onSubmit={handleSubmit} style={styles.createForm}>
                  <div style={styles.llmPromptPasteArea}>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="GitHub URL, @user, or owner/repo"
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
                      aria-label={loading ? "Generating tree ring" : "Generate tree ring"}
                      onMouseEnter={() => setCreateGrowHovered(true)}
                      onMouseLeave={() => setCreateGrowHovered(false)}
                    >
                      {loading ? (
                        <span key={growLoadingIdx} style={styles.llmGrowLoadStep} aria-hidden>
                          <GrowLoadingIcon size={19} strokeWidth={2} />
                        </span>
                      ) : createGrowHovered ? (
                        <Axe size={19} strokeWidth={2} aria-hidden />
                      ) : (
                        <Sprout size={19} strokeWidth={2} aria-hidden />
                      )}
                    </button>
                  </div>
                </form>

                <div style={styles.starterRowCreate}>
                  {starterExamples.map((entry) => (
                    <button
                      key={entry.slug}
                      type="button"
                      style={styles.starterChipCreate}
                      onClick={() => handleStarterSelect(entry)}
                    >
                      Try {entry.displayName}
                    </button>
                  ))}
                </div>

                <div style={styles.createStepAuthRow}>
                  <AuthButton onAuthChange={setAuthenticated} returnTo={currentPage} />
                </div>

                <div style={styles.createSecondaryBlock}>
                  <details style={styles.advancedDetails}>
                    <summary style={styles.tokenToggleCreate}>Advanced (token)</summary>
                    <p style={styles.createTokenHint}>
                      Sign in with GitHub uses your token on <strong>this app’s server</strong> ( /api ). Paste a PAT here only
                      if you need browser-direct GitHub access—for example <strong>local Vite</strong> without API routes.
                    </p>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_…"
                      style={styles.createTokenInput}
                    />
                  </details>
                </div>
              </div>

              <div
                style={{
                  ...styles.createStep,
                  ...styles.createStepDivider,
                  ...(hasRingData ? null : styles.createStepMuted),
                }}
              >
                <div style={styles.createStepHead}>
                  <span style={styles.createStepBadge}>2</span>
                  <h3 style={styles.createStepTitle}>Preview</h3>
                </div>
                <p style={styles.createStepHint}>
                  {!hasRingData
                    ? "Generate from step 1—the ring appears on the right."
                    : repoList.length > 1 && displayName !== "demo"
                      ? "Several repos on this account—filter to one or keep all."
                      : "Your ring is on the right."}
                </p>
                {repoList.length > 1 && displayName !== "demo" && (
                  <div style={styles.repoRowCreate}>
                    <span style={styles.repoRowLabel}>Repo filter</span>
                    <div style={styles.repoRowChips}>
                      <button
                        type="button"
                        style={{ ...styles.chipCreate, ...(selectedRepo === null ? styles.chipCreateActive : {}) }}
                        onClick={() => setSelectedRepo(null)}
                      >
                        All
                      </button>
                      {repoList.map((repo) => (
                        <button
                          key={repo.name}
                          type="button"
                          style={{
                            ...styles.chipCreate,
                            ...(selectedRepo === repo.name ? styles.chipCreateActive : {}),
                          }}
                          onClick={() => setSelectedRepo(repo.name)}
                        >
                          {repo.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {displayName === "demo" && (
                  <p style={styles.demoHintCreate}>Demo data is showing. Use step 1 for live GitHub data.</p>
                )}
              </div>

              <div
                style={{
                  ...styles.createStep,
                  ...(canExport ? null : styles.createStepMuted),
                }}
              >
                <div style={styles.createStepHead}>
                  <span style={styles.createStepBadge}>3</span>
                  <h3 style={styles.createStepTitle}>Print footer</h3>
                </div>
                <p style={styles.createStepHint}>
                  {canExport
                    ? "Choose which lines appear under the ring on PNG export and print. Preview updates next to the ring."
                    : "Available once you have live data from step 1 (not demo)."}
                </p>
                {canExport && (
                  <div style={styles.createFooterOptions}>
                    <label style={styles.createFooterOptionRow}>
                      <input
                        type="checkbox"
                        checked={footerPrintTitle}
                        onChange={(e) => setFooterPrintTitle(e.target.checked)}
                        style={styles.createReleaseCreditCheckbox}
                      />
                      <span>Title (display name)</span>
                    </label>
                    {creditTarget && (
                      <label style={styles.createFooterOptionRow}>
                        <input
                          type="checkbox"
                          checked={footerPrintOrgRepo}
                          onChange={(e) => setFooterPrintOrgRepo(e.target.checked)}
                          style={styles.createReleaseCreditCheckbox}
                        />
                        <span>
                          Organization / repo ({creditTarget.owner} / {creditTarget.repo}
                          {displayName.includes("/") ? "" : " — from filter or busiest repo"})
                        </span>
                      </label>
                    )}
                    {creditTarget && (
                      <label style={styles.createFooterOptionRow}>
                        <input
                          type="checkbox"
                          checked={footerPrintReleaseTag}
                          onChange={(e) => setFooterPrintReleaseTag(e.target.checked)}
                          style={styles.createReleaseCreditCheckbox}
                        />
                        <span>
                          Latest release tag (
                          <a
                            href={`https://github.com/${creditTarget.owner}/${creditTarget.repo}/releases`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.createInlineLink}
                          >
                            GitHub releases
                          </a>
                          )
                        </span>
                      </label>
                    )}
                    {footerPrintReleaseTag && creditTarget && (
                      <p style={styles.createReleaseCreditStatus}>
                        {releaseFetchState === "loading" && "Fetching release from GitHub…"}
                        {releaseFetchState === "none" && "No published release — release line will be omitted."}
                        {releaseFetchState === "error" && "Release lookup failed — release line will be omitted."}
                        {releaseFetchState === "done" && !releaseDetail && "No release data — line omitted."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={styles.createRight}>
            <div style={styles.vizAreaCreate}>
              {data && (
                <TreeRing
                  pullRequests={pullRequests}
                  username={displayName}
                  repoName={selectedRepo}
                  size={chartSize}
                />
              )}
              {loading && <div style={styles.loadingOverlay}>Loading…</div>}
            </div>
            {canExport && (footerPrintTitle || footerPrintOrgRepo || footerPrintReleaseTag) && (
              <div style={styles.printFooterPreviewWrap} aria-label="Print footer preview">
                <div style={styles.printFooterPreviewLabel}>Print footer</div>
                <div style={styles.printFooterPreviewPaper}>
                  {footerPrintTitle && (
                    <div style={styles.printFooterPreviewTitle}>{displayName}</div>
                  )}
                  {footerPrintOrgRepo && creditTarget && (
                    <div style={styles.printFooterPreviewOrg}>
                      {creditTarget.owner} / {creditTarget.repo}
                    </div>
                  )}
                  {footerPrintReleaseTag && creditTarget && (
                    <>
                      {releaseFetchState === "loading" && (
                        <div style={styles.printFooterPreviewMuted}>Loading release…</div>
                      )}
                      {releaseFetchState === "done" && (releaseDetail?.tagName || releaseDetail?.name) && (
                        <div style={styles.printFooterPreviewRelease}>
                          {releaseDetail.tagName || releaseDetail.name}
                        </div>
                      )}
                      {(releaseFetchState === "none"
                        || releaseFetchState === "error"
                        || (releaseFetchState === "done"
                          && !(releaseDetail?.tagName || releaseDetail?.name))) && (
                        <div style={styles.printFooterPreviewMuted}>No release tag</div>
                      )}
                    </>
                  )}
                  <div style={styles.printFooterPreviewSub}>
                    {pullRequests.length} contributions · dendrochronology
                  </div>
                </div>
              </div>
            )}
            <div style={styles.createActionsRowBelowViz}>
              <button
                type="button"
                style={styles.createSecondaryBtn}
                onClick={handleDownload}
                disabled={exporting || !canExport}
              >
                {exporting ? "Exporting…" : "Download PNG"}
              </button>
              <button
                type="button"
                style={styles.createPrimaryBtn}
                onClick={() => setShowPrintPanel(true)}
                disabled={!canExport}
              >
                Order Print
              </button>
            </div>
            {canExport && (
              <div style={styles.createShareBlockBelowViz}>
                <label style={styles.createShareCheckboxRow}>
                  <input
                    type="checkbox"
                    checked={shareToBrowse}
                    disabled={!authenticated || shareBusy}
                    onChange={(e) => void toggleShareToBrowse(e.target.checked)}
                    style={styles.createReleaseCreditCheckbox}
                  />
                  <span>Add to public Browse gallery</span>
                </label>
                <p style={styles.createShareHint}>
                  {authenticated
                    ? "Anyone can open shared trees from Browse. Uncheck to remove the current slug from the gallery."
                    : "Sign in with GitHub to publish this tree to the public Browse gallery."}
                </p>
                {shareMessage && (
                  <p
                    style={{
                      ...styles.createShareMessage,
                      ...(shareMessage.startsWith("Error") ? styles.createShareMessageErr : null),
                    }}
                  >
                    {shareMessage}
                  </p>
                )}
              </div>
            )}
            <div style={styles.infoAreaCreate}>
              <span>{pullRequests.length} pull request{pullRequests.length !== 1 ? "s" : ""}</span>
              <span style={styles.infoDividerCreate}>·</span>
              <span>width = files</span>
              <span style={styles.infoDividerCreate}>·</span>
              <span>texture = commits</span>
            </div>
          </div>
        </div>
      </section>
      ) : currentPage === "account" ? (
        <section style={styles.browsePage}>
          <div style={styles.browseTopBar}>
            <button type="button" style={styles.navTitleBtn} onClick={() => setCurrentPage("home")}>
              Dendrocode
            </button>
            <div style={styles.navLinks}>
              <button type="button" style={styles.navLinkBtn} onClick={() => setCurrentPage("create")}>
                Create
              </button>
              <button type="button" style={styles.navLinkBtn} onClick={() => setCurrentPage("browse")}>
                Browse
              </button>
              <TopBarNavAuth
                authenticated={authenticated}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                styles={styles}
              />
            </div>
          </div>
          <div style={styles.accountPageInner}>
            <div style={styles.accountPageTitleRow}>
              <div>
                <h2 style={styles.galleryTitle}>Your account</h2>
                <p style={styles.gallerySub}>Trees you’ve shared to the Browse gallery.</p>
              </div>
              {authenticated && (
                <a href="/api/auth/logout" style={styles.accountSignOut}>
                  Sign out
                </a>
              )}
            </div>
            {!authenticated ? (
              <div style={styles.accountSignInArea}>
                <p style={styles.createStepHint}>Sign in with GitHub (top right) to see your shared trees.</p>
              </div>
            ) : accountLoading ? (
              <p style={styles.createStepHint}>Loading…</p>
            ) : accountEntries.length === 0 ? (
              <p style={styles.createStepHint}>Nothing shared yet. Create a ring and check “Add to public Browse gallery.”</p>
            ) : (
              <ul style={styles.accountEntryList}>
                {accountEntries.map((entry) => (
                  <li key={entry.slug} style={styles.accountEntryCard}>
                    <div style={styles.accountEntryMain}>
                      <div style={styles.accountEntryTitle}>{entry.displayName}</div>
                      <div style={styles.accountEntryMeta}>
                        {entry.prCount ?? entry.pullRequests?.length ?? 0} contributions · {entry.slug}
                      </div>
                    </div>
                    <div style={styles.accountEntryActions}>
                      <button
                        type="button"
                        style={styles.createSecondaryBtn}
                        onClick={() => handleAccountEntryOpen(entry)}
                        disabled={shareBusy}
                      >
                        Open in Create
                      </button>
                      <button
                        type="button"
                        style={styles.createPrimaryBtn}
                        onClick={() => handleAccountOrderPrint(entry)}
                        disabled={shareBusy}
                      >
                        Order print
                      </button>
                      <button
                        type="button"
                        style={styles.accountUnshareBtn}
                        onClick={() => void handleAccountUnshare(entry.slug)}
                        disabled={shareBusy}
                      >
                        Unshare
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {shareMessage && (
              <p
                style={{
                  ...styles.createShareMessage,
                  ...(shareMessage.startsWith("Error") ? styles.createShareMessageErr : null),
                  marginTop: 16,
                }}
              >
                {shareMessage}
              </p>
            )}
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
                            <div style={styles.llmPromptDefinitions}>
                              <p style={styles.llmDefinition}>
                                <span style={styles.llmDefNum}>1.</span> A generator that draws concentric rings from
                                GitHub pull-request history—each band a span of collaboration—by analogy to{" "}
                                <strong style={styles.llmPromptStrong}>dendrochronology</strong>, the science of reading
                                past seasons and climates from the growth rings of trees.
                              </p>
                              <p style={styles.llmDefinition}>
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
                              </p>
                              <p style={styles.llmDefinition}>
                                <span style={styles.llmDefNum}>3.</span>
                                <Printer size={15} strokeWidth={1.75} style={styles.llmInlineIcon} aria-hidden />
                                Maybe get a print? Third step after you grow a ring: when it feels right, tap{" "}
                                <strong style={styles.llmPromptStrong}>Order Print</strong> on Create to put it on your
                                wall.
                              </p>
                            </div>
                          </div>
                          <form onSubmit={handleLandingSubmit} style={styles.llmPromptForm}>
                            <div style={styles.llmPromptPasteArea}>
                              <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
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
                          <LazyDendroStamp rings={item.rings} size={size} maxDpr={2} />
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
          ringPreview={{
            pullRequests,
            username: displayName,
            repoName: selectedRepo,
            size: Math.round(Math.min(340, chartSize)),
          }}
          printFooter={printFooter}
        />
      )}

      <footer style={styles.siteCredit} aria-label="Credit">
        Made by{" "}
        <a href="https://tinyfactories.space" target="_blank" rel="noopener noreferrer" style={styles.siteCreditLink}>
          tinyfactories.space
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
    padding: "6px 24px",
    maxWidth: 1240,
    margin: "0 auto",
  },
  /** Same row as browseTopBar but no horizontal padding — parent toolSection already uses padding 24px. */
  browseTopBarTool: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
  },
  navTitleBtn: {
    margin: 0,
    padding: 0,
    border: "none",
    background: "none",
    cursor: "pointer",
    textAlign: "left",
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "#18181b",
    lineHeight: 1.12,
    fontFamily:
      'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
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
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.02em",
    color: "#2d6a4f",
    fontFamily: "inherit",
    padding: 0,
    textDecoration: "underline",
    textUnderlineOffset: 3,
    textDecorationColor: "rgba(45, 106, 79, 0.45)",
  },
  navSignIn: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.02em",
    color: "#2d6a4f",
    fontFamily: "inherit",
    textDecoration: "underline",
    textUnderlineOffset: 3,
    textDecorationColor: "rgba(45, 106, 79, 0.45)",
  },
  navAccountIconBtn: {
    border: "none",
    background: "none",
    cursor: "pointer",
    padding: "4px 2px",
    margin: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#2d6a4f",
    borderRadius: 8,
    lineHeight: 0,
  },
  navAccountIconBtnActive: {
    color: "#14532d",
    boxShadow: "inset 0 0 0 1px rgba(45, 106, 79, 0.35)",
    background: "rgba(45, 106, 79, 0.06)",
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
    gap: 0,
    padding: "12px 14px 14px",
    justifyContent: "flex-start",
    flex: 1,
    minHeight: 0,
    height: "100%",
  },
  llmPromptCardHeader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
    width: "100%",
    flex: 1,
    minHeight: 0,
    textAlign: "left",
  },
  llmPromptDefinitions: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    width: "100%",
    justifyContent: "space-evenly",
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
    marginTop: "auto",
    flexShrink: 0,
    paddingTop: 16,
  },
  llmPromptPasteArea: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    background: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: 0,
    padding: "12px 14px 12px 16px",
    boxSizing: "border-box",
    minHeight: 56,
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
  createWorkspace: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: 28,
    marginTop: 12,
  },
  createLeft: {
    flex: "1 1 360px",
    minWidth: 280,
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  createRight: {
    flex: "1 1 420px",
    minWidth: 280,
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  createIntro: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  createPageTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "#18181b",
    lineHeight: 1.12,
    fontFamily:
      'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  },
  createPageSub: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "#3f3f46",
  },
  createPanelCard: {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: 0,
    padding: "18px 18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    boxSizing: "border-box",
  },
  createStep: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "4px 0 20px",
  },
  createStepDivider: {
    borderTop: "1px solid #e4e4e7",
    marginTop: 4,
    paddingTop: 20,
  },
  createStepMuted: {
    opacity: 0.5,
  },
  createStepHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  createStepBadge: {
    flexShrink: 0,
    width: 26,
    height: 26,
    borderRadius: 0,
    background: "#18181b",
    color: "#fafafa",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: "26px",
    textAlign: "center",
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  createStepTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.02em",
    color: "#18181b",
    lineHeight: 1.3,
  },
  createStepHint: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: "#71717a",
    marginTop: -2,
  },
  createStepCode: {
    fontSize: "0.92em",
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: "#52525b",
    background: "#f4f4f5",
    padding: "1px 5px",
  },
  createStepAuthRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  createForm: {
    width: "100%",
    margin: 0,
    display: "flex",
    flexDirection: "column",
  },
  createReleaseCreditBlock: {
    marginTop: 12,
    marginBottom: 4,
    padding: "12px 14px",
    background: "#fafafa",
    border: "1px solid #e4e4e7",
    borderRadius: 0,
  },
  createReleaseCreditLabel: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    fontSize: 13,
    lineHeight: 1.55,
    color: "#3f3f46",
    cursor: "pointer",
    margin: 0,
  },
  createReleaseCreditCheckbox: {
    marginTop: 3,
    flexShrink: 0,
    accentColor: "#18181b",
  },
  createReleaseCreditStatus: {
    margin: "10px 0 0 26px",
    fontSize: 12,
    lineHeight: 1.5,
    color: "#71717a",
  },
  createReleaseCreditPrefix: {
    marginRight: 4,
  },
  createReleaseCreditCode: {
    fontSize: "0.95em",
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: "#52525b",
    background: "#f4f4f5",
    padding: "2px 6px",
  },
  createInlineLink: {
    color: "#2563eb",
    textUnderlineOffset: 2,
  },
  createFooterOptions: {
    marginTop: 4,
    padding: "12px 14px",
    background: "#fafafa",
    border: "1px solid #e4e4e7",
    borderRadius: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  createFooterOptionRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    fontSize: 13,
    lineHeight: 1.55,
    color: "#3f3f46",
    cursor: "pointer",
    margin: 0,
  },
  createActionsRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  createShareBlock: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #e4e4e7",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
  },
  createShareBtn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 0,
    border: "1px solid #2d6a4f",
    background: "#f0fdf4",
    color: "#14532d",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  createShareHint: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: "#71717a",
    maxWidth: 420,
  },
  createShareMessage: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "#166534",
    fontWeight: 500,
  },
  createShareMessageErr: {
    color: "#b45309",
    fontWeight: 400,
  },
  createSecondaryBtn: {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 0,
    border: "1px solid #e4e4e7",
    background: "#ffffff",
    color: "#3f3f46",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  createPrimaryBtn: {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 0,
    border: "1px solid rgba(45, 106, 79, 0.45)",
    background: "linear-gradient(160deg, #3d8f69 0%, #2d6a4f 55%, #256955 100%)",
    color: "#f5faf7",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  createSecondaryBlock: {
    marginTop: -4,
  },
  tokenToggleCreate: {
    background: "none",
    border: "none",
    color: "#71717a",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
    fontFamily: "inherit",
    padding: 0,
  },
  createTokenHint: {
    margin: "0 0 10px",
    fontSize: 12,
    lineHeight: 1.5,
    color: "#71717a",
  },
  createTokenInput: {
    marginTop: 10,
    width: "100%",
    maxWidth: 280,
    padding: "10px 12px",
    fontSize: 12,
    border: "1px solid #e4e4e7",
    borderRadius: 0,
    background: "#fafafa",
    color: "#18181b",
    outline: "none",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    boxSizing: "border-box",
  },
  starterRowCreate: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-start",
  },
  starterChipCreate: {
    border: "1px solid #e4e4e7",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12,
    background: "#fafafa",
    color: "#3f3f46",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  repoRowCreate: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  repoRowLabel: {
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(82, 82, 91, 0.85)",
  },
  repoRowChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  chipCreate: {
    padding: "5px 10px",
    fontSize: 11,
    borderRadius: 999,
    border: "1px solid #e4e4e7",
    background: "#fafafa",
    color: "#52525b",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  chipCreateActive: {
    background: "#18181b",
    borderColor: "#18181b",
    color: "#fafafa",
  },
  demoHintCreate: {
    fontSize: 12,
    color: "#71717a",
    margin: 0,
    lineHeight: 1.45,
  },
  vizAreaCreate: {
    minHeight: 300,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    background: "#ffffff",
    border: "1px solid #e4e4e7",
    borderRadius: 0,
    padding: "20px 16px",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  printFooterPreviewWrap: {
    marginTop: 4,
  },
  printFooterPreviewLabel: {
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "rgba(82, 82, 91, 0.85)",
    marginBottom: 6,
  },
  printFooterPreviewPaper: {
    background: "#f5f0eb",
    border: "1px solid #e4e4e7",
    borderRadius: 0,
    padding: "14px 16px 12px",
    textAlign: "center",
  },
  printFooterPreviewTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#7a6a58",
    marginBottom: 6,
    lineHeight: 1.3,
  },
  printFooterPreviewOrg: {
    fontSize: 13,
    fontWeight: 600,
    color: "#5c4d3f",
    marginBottom: 4,
  },
  printFooterPreviewRelease: {
    fontSize: 12,
    fontWeight: 600,
    color: "#4a3f35",
    marginBottom: 4,
  },
  printFooterPreviewMuted: {
    fontSize: 12,
    color: "#a1a1aa",
    marginBottom: 4,
  },
  printFooterPreviewSub: {
    fontSize: 11,
    color: "#a89888",
    marginTop: 6,
    paddingTop: 8,
    borderTop: "1px solid rgba(228, 228, 231, 0.85)",
  },
  createActionsRowBelowViz: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  createShareBlockBelowViz: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #e4e4e7",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
  },
  createShareCheckboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 13,
    color: "#3f3f46",
    cursor: "pointer",
    margin: 0,
    lineHeight: 1.45,
  },
  accountPageInner: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "8px 24px 48px",
  },
  accountPageTitleRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  accountSignOut: {
    fontSize: 12,
    fontWeight: 500,
    color: "#71717a",
    textDecoration: "underline",
    textUnderlineOffset: 3,
    textDecorationColor: "rgba(113, 113, 122, 0.45)",
    paddingTop: 4,
  },
  accountSignInArea: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
  },
  accountEntryList: {
    listStyle: "none",
    margin: "16px 0 0",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  accountEntryCard: {
    border: "1px solid #e4e4e7",
    borderRadius: 0,
    background: "#ffffff",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  accountEntryMain: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  accountEntryTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#18181b",
  },
  accountEntryMeta: {
    fontSize: 12,
    color: "#71717a",
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  accountEntryActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  accountUnshareBtn: {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 0,
    border: "1px solid #e4e4e7",
    background: "#fafafa",
    color: "#71717a",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  infoAreaCreate: {
    fontSize: 12,
    color: "#71717a",
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    lineHeight: 1.45,
  },
  infoDividerCreate: {
    color: "#d4d4d8",
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
    color: "#3a3028",
    fontSize: 18,
    fontWeight: 500,
    letterSpacing: "-0.02em",
  },
  gallerySub: {
    margin: "8px 0 14px",
    color: "rgba(58, 48, 40, 0.55)",
    fontSize: 13,
    lineHeight: 1.45,
  },
};
