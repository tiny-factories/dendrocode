/**
 * GET /api/auth/logout — Clears the auth cookie.
 */

export default function handler(req, res) {
  res.setHeader("Set-Cookie",
    `gh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
  res.redirect(302, "/");
}
