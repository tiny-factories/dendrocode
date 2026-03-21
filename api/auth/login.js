/**
 * GET /api/auth/login — Redirects to GitHub OAuth authorization page.
 * Optional ?return= create | browse | home — where to land after OAuth (hash route).
 */

import { publicOrigin, secureCookieDirective } from "../lib/cookieSecure.js";

const ALLOWED_RETURN = new Set(["home", "create", "browse", "account"]);

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });

  const ret = typeof req.query.return === "string" && ALLOWED_RETURN.has(req.query.return)
    ? req.query.return
    : "home";

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);

  const sec = secureCookieDirective(req);
  res.setHeader("Set-Cookie", [
    `oauth_state=${state}; HttpOnly${sec}; SameSite=Lax; Path=/; Max-Age=600`,
    `oauth_return=${ret}; HttpOnly${sec}; SameSite=Lax; Path=/; Max-Age=600`,
  ]);

  // Optional: set GITHUB_OAUTH_REDIRECT_ORIGIN in .env.local (e.g. http://localhost:3000) so redirect_uri
  // matches GitHub's "Authorization callback URL" exactly when Host differs (127.0.0.1 vs localhost, port).
  const rawOrigin = process.env.GITHUB_OAUTH_REDIRECT_ORIGIN?.trim();
  const origin = rawOrigin
    ? rawOrigin.replace(/\/$/, "")
    : publicOrigin(req);
  const redirectUri = `${origin}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo",
    state,
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
