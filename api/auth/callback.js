/**
 * GET /api/auth/callback — GitHub OAuth callback.
 * Exchanges authorization code for access token, stores in HttpOnly cookie.
 */

import { secureCookieDirective } from "../lib/cookieSecure.js";

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

const HASH_BY_RETURN = {
  home: "",
  create: "#/create",
  browse: "#/browse",
  account: "#/account",
};

/** @param {string} search e.g. "auth=success" or "auth_error=foo" */
function redirectUrl(cookieHeader, search) {
  const returnKey = parseCookie(cookieHeader, "oauth_return") || "home";
  const hash = HASH_BY_RETURN[returnKey] || "";
  const base = search ? `/?${search}` : "/";
  return hash ? `${base}${hash}` : base;
}

function clearOAuthCookies(req) {
  const sec = secureCookieDirective(req);
  return [
    `oauth_state=; HttpOnly${sec}; SameSite=Lax; Path=/; Max-Age=0`,
    `oauth_return=; HttpOnly${sec}; SameSite=Lax; Path=/; Max-Age=0`,
  ];
}

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code || !state) {
    const dest = redirectUrl(req.headers.cookie, "auth_error=missing_params");
    res.setHeader("Set-Cookie", clearOAuthCookies(req));
    return res.redirect(302, dest);
  }

  // Validate state matches what we set in login
  const savedState = parseCookie(req.headers.cookie, "oauth_state");
  if (!savedState || savedState !== state) {
    const dest = redirectUrl(req.headers.cookie, "auth_error=invalid_state");
    res.setHeader("Set-Cookie", clearOAuthCookies(req));
    return res.redirect(302, dest);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const dest = redirectUrl(req.headers.cookie, "auth_error=not_configured");
    res.setHeader("Set-Cookie", clearOAuthCookies(req));
    return res.redirect(302, dest);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      const dest = redirectUrl(req.headers.cookie, `auth_error=${encodeURIComponent(tokenData.error)}`);
      res.setHeader("Set-Cookie", clearOAuthCookies(req));
      return res.redirect(302, dest);
    }

    const { access_token } = tokenData;

    const dest = redirectUrl(req.headers.cookie, "auth=success");
    const sec = secureCookieDirective(req);
    const cookies = [
      `gh_token=${access_token}; HttpOnly${sec}; SameSite=Lax; Path=/; Max-Age=2592000`,
      ...clearOAuthCookies(req),
    ];

    res.setHeader("Set-Cookie", cookies);
    res.redirect(302, dest);
  } catch (e) {
    console.error("OAuth callback error:", e);
    const dest = redirectUrl(req.headers.cookie, "auth_error=exchange_failed");
    res.setHeader("Set-Cookie", clearOAuthCookies(req));
    res.redirect(302, dest);
  }
}
