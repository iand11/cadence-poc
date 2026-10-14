// Stripe prepay for Prelude-managed Meta campaigns: before a campaign in Prelude's ad
// account goes live, the artist pays its budget plus Prelude's fee through Stripe
// Checkout. Payment confirmation (webhook, or a status check when the artist returns)
// turns the campaign on. Plain REST calls, no SDK.
//
// Env:
//   MANAGED_ADS_PREPAY=stripe   — turns prepay on. Off: a Prelude admin approves go-live.
//   STRIPE_SECRET_KEY           — sk_live_… / sk_test_…
//   STRIPE_WEBHOOK_SECRET       — whsec_… for /api/stripe/webhook
//   MANAGED_ADS_FEE_PERCENT     — optional; Prelude's fee on top of the budget (default 10)
import crypto from 'node:crypto';

const API = 'https://api.stripe.com/v1';
const DAY_MS = 24 * 60 * 60 * 1000;

export function prepayEnabled() {
  return process.env.MANAGED_ADS_PREPAY === 'stripe';
}

/** Prepay is on but Stripe isn't configured: block go-live rather than run unpaid. */
export function requireStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw Object.assign(new Error('Payments are not set up on the server (STRIPE_SECRET_KEY).'), { status: 409, code: 'payments_not_configured' });
  }
}

export const feePercent = () => {
  const n = Number(process.env.MANAGED_ADS_FEE_PERCENT);
  return Number.isFinite(n) && n >= 0 ? n : 10;
};

/**
 * What the artist pays up front, in cents: the most Meta can spend (lifetime budget, or
 * daily budget × days through the end date) plus Prelude's fee.
 */
export function prepayQuote({ budget, budget_period: period, start_date: startDate, end_date: endDate }, today = new Date()) {
  let spend = Number(budget);
  if (period === 'daily') {
    if (!endDate) {
      throw Object.assign(new Error('A daily budget needs an end date so the total can be paid up front.'), { status: 400 });
    }
    const start = Math.max(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
      startDate ? new Date(startDate).getTime() : 0,
    );
    const end = new Date(endDate).getTime();
    const days = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
    spend *= days;
  }
  const budgetCents = Math.round(spend * 100);
  const feeCents = Math.round(budgetCents * feePercent() / 100);
  return { budgetCents, feeCents, totalCents: budgetCents + feeCents };
}

function form(params, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function stripe(method, path, params) {
  requireStripe();
  const res = await fetch(`${API}/${path}${method === 'GET' && params ? `?${form(params)}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    body: method === 'GET' ? undefined : form(params || {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message || `Stripe error (${res.status})`), { status: 502 });
  }
  return body;
}

/** A Checkout Session for one managed campaign. Returns { id, url }. */
export function createCheckout({ campaign, quote, successUrl, cancelUrl }) {
  const label = `${campaign.artist_name || 'Instagram'} ad${campaign.ig_username ? ` · @${campaign.ig_username}` : ''}`;
  return stripe('POST', 'checkout/sessions', {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: campaign.campaign_id,
    metadata: { campaign_id: campaign.campaign_id, user_id: campaign.user_id },
    payment_intent_data: { metadata: { campaign_id: campaign.campaign_id } },
    line_items: [
      { quantity: 1, price_data: { currency: 'usd', unit_amount: quote.budgetCents, product_data: { name: `Ad budget · ${label}` } } },
      ...(quote.feeCents > 0
        ? [{ quantity: 1, price_data: { currency: 'usd', unit_amount: quote.feeCents, product_data: { name: `Prelude fee (${feePercent()}%)` } } }]
        : []),
    ],
  });
}

export const getCheckout = (id) => stripe('GET', `checkout/sessions/${encodeURIComponent(id)}`);

/** Verify a Stripe-Signature header against the raw body. Returns the event or null. */
export function verifyWebhook(raw, header, toleranceSec = 300) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return null;
  const parts = Object.fromEntries(String(header).split(',').map(p => p.split('=')).filter(p => p.length === 2 && p[0] === 't'));
  const sigs = String(header).split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const ok = sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
  if (!ok) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
