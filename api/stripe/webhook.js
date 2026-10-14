// POST /api/stripe/webhook — Stripe events for Prelude-managed Meta campaigns.
// checkout.session.completed (paid) → record the payment and turn the campaign on.
// Point a Stripe webhook endpoint at this URL with that event; its signing secret is
// STRIPE_WEBHOOK_SECRET.
import { verifyWebhook } from '../lib/stripe.js';
import { getManagedCampaign } from '../lib/meta.js';
import { settleCheckout } from '../campaign/meta-campaign.js';

// Read the stream, never req.body: the signature is over the exact bytes Stripe sent.
async function rawBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end();
  }
  const event = verifyWebhook(await rawBody(req), req.headers['stripe-signature']);
  if (!event) return res.status(400).json({ error: 'Invalid signature' });

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data?.object || {};
    const managed = session.metadata?.campaign_id && await getManagedCampaign(session.metadata.campaign_id);
    if (managed) {
      try {
        await settleCheckout(managed, session);
      } catch (err) {
        // Paid but Meta refused: a 500 makes Stripe retry, and the owner's next sync retries too
        console.error('[stripe] going live after payment failed', managed.campaign_id, err.message);
        return res.status(500).json({ error: err.message });
      }
    }
  }
  return res.status(200).json({ received: true });
}

// Vercel: keep the raw body for signature verification
export const config = { api: { bodyParser: false } };
