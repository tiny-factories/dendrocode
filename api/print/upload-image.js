import "../lib/loadLocalEnv.js";

/**
 * POST /api/print/upload-image
 * Uploads a print-quality PNG to Vercel Blob storage.
 * Body: raw PNG binary (Content-Type: image/png)
 */

let put;
try {
  put = (await import("@vercel/blob")).put;
} catch {
  put = null;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!put) return res.status(500).json({ error: "Blob storage not configured" });

  try {
    const filename = `prints/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

    const blob = await put(filename, req.body, {
      access: "public",
      contentType: "image/png",
    });

    return res.status(200).json({ url: blob.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
