/**
 * GET /api/auth/logout — Clears the auth cookie.
 */

import { secureCookieDirective } from "../lib/cookieSecure.js";

export default function handler(req, res) {
  const sec = secureCookieDirective(req);
  res.setHeader("Set-Cookie", `gh_token=; HttpOnly${sec}; SameSite=Lax; Path=/; Max-Age=0`);
  res.redirect(302, "/");
}
