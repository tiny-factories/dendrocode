import "../lib/loadLocalEnv.js";

/**
 * POST /api/print/webhook
 * Stripe webhook — on successful payment, creates a Prodigi order.
 */

export const config = {
  api: {
    bodyParser: false, // Stripe needs raw body for signature verification
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const prodigiKey = process.env.PRODIGI_API_KEY;

  if (!stripeWebhookSecret || !prodigiKey) {
    return res.status(500).json({ error: "Not configured" });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];

  // Verify webhook signature using Stripe's header format
  // In production, use stripe.webhooks.constructEvent() from the SDK
  // For now, we'll parse the event and check basic structure
  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, skipped: true });
  }

  const session = event.data.object;
  const { sku, paper, image_url, display_name } = session.metadata || {};
  const shipping = session.shipping_details || session.customer_details;

  if (!sku || !image_url) {
    console.error("Missing metadata in checkout session:", session.id);
    return res.status(400).json({ error: "Missing order metadata" });
  }

  // Create Prodigi order
  try {
    const prodigiEnv = process.env.PRODIGI_SANDBOX === "true"
      ? "https://api.sandbox.prodigi.com"
      : "https://api.prodigi.com";

    const orderRes = await fetch(`${prodigiEnv}/v4.0/orders`, {
      method: "POST",
      headers: {
        "X-API-Key": prodigiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        shippingMethod: "Standard",
        recipient: {
          name: shipping?.name || "Customer",
          address: {
            line1: shipping?.address?.line1 || "",
            line2: shipping?.address?.line2 || "",
            postalOrZipCode: shipping?.address?.postal_code || "",
            countryCode: shipping?.address?.country || "US",
            townOrCity: shipping?.address?.city || "",
            stateOrCounty: shipping?.address?.state || "",
          },
        },
        items: [
          {
            sku,
            copies: 1,
            sizing: "fillPrintArea",
            assets: [
              {
                printArea: "default",
                url: image_url,
              },
            ],
          },
        ],
        metadata: {
          source: "dendrochronology",
          displayName: display_name,
          stripeSessionId: session.id,
        },
      }),
    });

    const order = await orderRes.json();

    if (!orderRes.ok) {
      console.error("Prodigi order error:", JSON.stringify(order));
      return res.status(502).json({ error: "Failed to create print order" });
    }

    console.log("Prodigi order created:", order.id);
    return res.status(200).json({ received: true, prodigiOrderId: order.id });
  } catch (e) {
    console.error("Prodigi error:", e.message);
    return res.status(502).json({ error: e.message });
  }
}
