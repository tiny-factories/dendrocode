/**
 * POST /api/print/create-checkout
 * Creates a Stripe Checkout session for a print order.
 *
 * Body: { size: { sku, label, price }, paper: { id, label, surcharge }, total, imageUrl, displayName }
 */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: "Stripe not configured" });

  const { size, paper, total, imageUrl, displayName } = req.body;

  if (!size?.sku || !total || !imageUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Create Stripe Checkout Session via API (no SDK needed)
    const host = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

    const params = new URLSearchParams({
      mode: "payment",
      success_url: `${host}/?print=success`,
      cancel_url: `${host}/?print=cancelled`,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(total * 100), // cents
      "line_items[0][price_data][product_data][name]": `Dendrochronology Print — ${size.label}`,
      "line_items[0][price_data][product_data][description]": `${displayName || "Tree Ring"} on ${paper.label} paper`,
      "line_items[0][quantity]": "1",
      "shipping_address_collection[allowed_countries][]": "US",
      "metadata[sku]": size.sku,
      "metadata[paper]": paper.id,
      "metadata[image_url]": imageUrl,
      "metadata[display_name]": displayName || "",
    });

    // Stripe Checkout shows this image next to the line item (URL must be HTTPS and publicly readable).
    if (typeof imageUrl === "string" && /^https:\/\//i.test(imageUrl)) {
      params.append(
        "line_items[0][price_data][product_data][images][0]",
        imageUrl,
      );
    }

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const session = await sessionRes.json();

    if (session.error) {
      return res.status(400).json({ error: session.error.message });
    }

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
