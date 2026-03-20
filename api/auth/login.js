/**
 * GET /api/auth/login — Redirects to GitHub OAuth authorization page.
 * Optional ?return= create | browse | home — where to land after OAuth (hash route).
 */

const ALLOWED_RETURN = new Set(["home", "create", "browse"]);

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });

  const ret = typeof req.query.return === "string" && ALLOWED_RETURN.has(req.query.return)
    ? req.query.return
    : "home";

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);

  res.setHeader("Set-Cookie", [
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    `oauth_return=${ret}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
  ]);

  const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo",
    state,
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
