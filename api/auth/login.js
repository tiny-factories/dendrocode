/**
 * GET /api/auth/login — Redirects to GitHub OAuth authorization page.
 */

export default function handler(req, res) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "GITHUB_CLIENT_ID not configured" });

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);

  // Store state in a short-lived cookie for validation in callback
  res.setHeader("Set-Cookie",
    `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  );

  const redirectUri = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo",
    state,
  });

  res.redirect(302, `https://github.com/login/oauth/authorize?${params}`);
}
