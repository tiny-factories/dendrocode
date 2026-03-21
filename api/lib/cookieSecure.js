import "./loadLocalEnv.js";

/**
 * Cookie `Secure` and OAuth redirect base: browsers ignore Secure cookies on http://
 * (e.g. local dev). Vercel sets x-forwarded-proto to https in production.
 */

function forwardedProto(req) {
  const raw = req.headers["x-forwarded-proto"];
  if (typeof raw !== "string") return "";
  return raw.split(",")[0].trim().toLowerCase();
}

/** @param {import("http").IncomingMessage} req */
export function secureCookieDirective(req) {
  const p = forwardedProto(req);
  if (p === "https") return "; Secure";
  if (p === "http") return "";
  return req.socket?.encrypted ? "; Secure" : "";
}

/** @param {import("http").IncomingMessage} req */
export function publicOrigin(req) {
  const p = forwardedProto(req);
  const proto =
    p === "https" || p === "http" ? p : req.socket?.encrypted ? "https" : "http";
  const host = req.headers.host || "localhost";
  return `${proto}://${host}`;
}
