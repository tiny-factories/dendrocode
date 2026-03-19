/**
 * Seed gallery data — deterministic demo trees for curated popular items.
 * This keeps the Forest view interesting even without live API calls.
 */

function makeSeedPRs(repoName, count, baseSeed) {
  const prs = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const seed = baseSeed + i;
    const r = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    const rand = r - Math.floor(r);

    const isBig = rand < 0.15;
    const isTiny = rand > 0.7;

    prs.push({
      repo: repoName,
      number: i + 1,
      title: `PR #${i + 1}`,
      mergedAt: new Date(now - (count - i) * dayMs * (1.5 + rand)).toISOString(),
      changedFiles: isTiny ? Math.ceil(rand * 3) : isBig ? Math.ceil(rand * 60) + 10 : Math.ceil(rand * 15) + 2,
      additions: isTiny ? Math.ceil(rand * 30) : isBig ? Math.ceil(rand * 2000) + 100 : Math.ceil(rand * 400) + 10,
      deletions: isTiny ? Math.ceil(rand * 10) : isBig ? Math.ceil(rand * 500) : Math.ceil(rand * 120),
      commits: isTiny ? 1 : isBig ? Math.ceil(rand * 20) + 3 : Math.ceil(rand * 8) + 1,
    });
  }

  return prs;
}

const curatedSeeds = [
  // Popular repositories
  { slug: "repo:vercel:next.js", displayName: "vercel/next.js", repoName: "next.js", count: 68, seed: 200, category: "popular-repos" },
  { slug: "repo:facebook:react", displayName: "facebook/react", repoName: "react", count: 60, seed: 300, category: "popular-repos" },
  { slug: "repo:microsoft:vscode", displayName: "microsoft/vscode", repoName: "vscode", count: 75, seed: 400, category: "popular-repos" },
  { slug: "repo:torvalds:linux", displayName: "torvalds/linux", repoName: "linux", count: 80, seed: 500, category: "popular-repos" },
  { slug: "repo:kubernetes:kubernetes", displayName: "kubernetes/kubernetes", repoName: "kubernetes", count: 72, seed: 520, category: "popular-repos" },
  { slug: "repo:rust-lang:rust", displayName: "rust-lang/rust", repoName: "rust", count: 70, seed: 540, category: "popular-repos" },

  // Popular/trendy frameworks and tooling
  { slug: "repo:sveltejs:svelte", displayName: "sveltejs/svelte", repoName: "svelte", count: 46, seed: 700, category: "frameworks" },
  { slug: "repo:nuxt:nuxt", displayName: "nuxt/nuxt", repoName: "nuxt", count: 52, seed: 720, category: "frameworks" },
  { slug: "repo:angular:angular", displayName: "angular/angular", repoName: "angular", count: 62, seed: 740, category: "frameworks" },
  { slug: "repo:remix-run:remix", displayName: "remix-run/remix", repoName: "remix", count: 44, seed: 760, category: "frameworks" },
  { slug: "repo:tailwindlabs:tailwindcss", displayName: "tailwindlabs/tailwindcss", repoName: "tailwindcss", count: 48, seed: 780, category: "frameworks" },
  { slug: "repo:vitejs:vite", displayName: "vitejs/vite", repoName: "vite", count: 50, seed: 800, category: "frameworks" },

  // Popular npm ecosystem packages
  { slug: "repo:axios:axios", displayName: "axios/axios", repoName: "axios", count: 42, seed: 900, category: "npm-popular" },
  { slug: "repo:lodash:lodash", displayName: "lodash/lodash", repoName: "lodash", count: 40, seed: 920, category: "npm-popular" },
  { slug: "repo:expressjs:express", displayName: "expressjs/express", repoName: "express", count: 45, seed: 940, category: "npm-popular" },
  { slug: "repo:prettier:prettier", displayName: "prettier/prettier", repoName: "prettier", count: 46, seed: 960, category: "npm-popular" },
  { slug: "repo:eslint:eslint", displayName: "eslint/eslint", repoName: "eslint", count: 52, seed: 980, category: "npm-popular" },
  { slug: "repo:facebook:jest", displayName: "facebook/jest", repoName: "jest", count: 47, seed: 1000, category: "npm-popular" },
  { slug: "repo:reduxjs:redux", displayName: "reduxjs/redux", repoName: "redux", count: 39, seed: 1020, category: "npm-popular" },
  { slug: "repo:mui:material-ui", displayName: "mui/material-ui", repoName: "material-ui", count: 55, seed: 1040, category: "npm-popular" },

];

export const seedGallery = curatedSeeds.map((item) => ({
  slug: item.slug,
  displayName: item.displayName,
  category: item.category,
  pullRequests: makeSeedPRs(item.repoName, item.count, item.seed),
}));
