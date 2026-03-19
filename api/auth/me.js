/**
 * GET /api/auth/me — Returns current authenticated user info.
 */

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  const token = parseCookie(req.headers.cookie, "gh_token");

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userRes.ok) {
      // Token expired or revoked
      res.setHeader("Set-Cookie",
        `gh_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
      );
      return res.status(401).json({ authenticated: false });
    }

    const user = await userRes.json();

    return res.status(200).json({
      authenticated: true,
      user: {
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
