/**
 * GET /api/auth/callback — GitHub OAuth callback.
 * Exchanges authorization code for access token, stores in HttpOnly cookie.
 */

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect(302, "/?auth_error=missing_params");
  }

  // Validate state matches what we set in login
  const savedState = parseCookie(req.headers.cookie, "oauth_state");
  if (!savedState || savedState !== state) {
    return res.redirect(302, "/?auth_error=invalid_state");
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(302, "/?auth_error=not_configured");
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
      return res.redirect(302, `/?auth_error=${tokenData.error}`);
    }

    const { access_token } = tokenData;

    // Set access token as HttpOnly cookie
    const cookies = [
      `gh_token=${access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
      // Clear the state cookie
      `oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
    ];

    res.setHeader("Set-Cookie", cookies);
    res.redirect(302, "/?auth=success");
  } catch (e) {
    console.error("OAuth callback error:", e);
    res.redirect(302, "/?auth_error=exchange_failed");
  }
}
