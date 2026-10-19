// /api/campaign/meta-campaign — read or change a Meta campaign Prelude created.
//
//   GET ?id=<campaignId>             → { status, effectiveStatus, objective, issues, budget, insights,
//                                        daily, breakdowns, ads, managed?, review? } (lib/meta-insights.js)
//   POST { id, status: 'ACTIVE' }    → go live (campaign, ad sets and ads)
//   POST { id, status: 'PAUSED' }    → pause the campaign
//
// Only campaigns in an ad account the user assigned in Ad Accounts are reachable here.
//
// Prelude-managed campaigns (in Prelude's ad account, billed to Prelude) are reachable by
// the user who launched them and by Prelude admins (PRELUDE_ADMIN_UIDS). For them:
//   POST { id, status: 'ACTIVE' }    → from the owner, with MANAGED_ADS_PREPAY=stripe:
//                                      { checkoutUrl, quote } — pay budget + fee in Stripe Checkout;
//                                      payment turns it on (webhook, or the next GET once paid).
//                                      Already paid (re-activating after a pause): goes live.
//                                      From the owner without prepay: asks Prelude to review
//                                      (review: 'requested'). From an admin: goes live.
//   POST { id, status: 'DECLINED' }  → admin only: declines the request (stays paused)
//   GET ?review=1                    → admin only: { campaigns } waiting for review
import {
  graph, getUid, requireConnection, readBody, sendError, assignedAdAccounts,
  getManagedCampaign, setManagedReview, listManagedReviews, preludeAccount, isAdmin,
  activateCampaign, setManagedCheckout, markManagedPaid,
} from '../lib/meta.js';
import { campaignReport, CAMPAIGN_FIELDS } from '../lib/meta-insights.js';
import { saveReportSnapshot } from '../lib/campaign-snapshots.js';
import { prepayEnabled, prepayQuote, createCheckout, getCheckout } from '../lib/stripe.js';

const forbidden = (message) => Object.assign(new Error(message), { status: 403 });

function checkId(id) {
  if (!/^\d+$/.test(String(id || ''))) throw Object.assign(new Error('Invalid campaign id'), { status: 400 });
}

/** The campaign plus the token that can act on it, or a 403. */
export async function loadCampaign(uid, id) {
  checkId(id);
  const managed = await getManagedCampaign(id);
  if (managed) {
    if (managed.user_id !== uid && !isAdmin(uid)) throw forbidden('That campaign belongs to another Prelude account.');
    const { token } = preludeAccount();
    const campaign = await graph('GET', id, token, { fields: CAMPAIGN_FIELDS });
    return { campaign, token, managed };
  }
  const conn = await requireConnection(uid);
  const campaign = await graph('GET', id, conn.token, { fields: CAMPAIGN_FIELDS });
  if (!assignedAdAccounts(conn.selection).has(`act_${campaign.account_id}`)) {
    throw forbidden('That campaign is not in one of your assigned ad accounts.');
  }
  return { campaign, token: conn.token, managed: null };
}

function origin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function safeQuote(managed) {
  try { return prepayQuote(managed); } catch { return null; }
}

/**
 * If the campaign's Checkout Session is paid, record it and go live (once).
 * Shared with the Stripe webhook. Returns true when it went live.
 */
export async function settleCheckout(managed, session = null) {
  const s = session || await getCheckout(managed.stripe_session_id);
  if (s.payment_status !== 'paid' || s.metadata?.campaign_id !== managed.campaign_id) return false;
  if (!await markManagedPaid(managed.campaign_id, s.id, s.amount_total)) return false;
  await activateCampaign(managed.campaign_id, preludeAccount().token);
  return true;
}

const shapeReview = (m) => ({
  id: m.campaign_id,
  artistName: m.artist_name,
  igUsername: m.ig_username,
  budget: Number(m.budget),
  period: m.budget_period,
  endDate: m.end_date,
  requestedAt: m.requested_at,
  review: m.review_status,
});

export default async function handler(req, res) {
  try {
    const uid = await getUid(req);

    if (req.method === 'GET') {
      const params = new URL(req.url, 'http://localhost').searchParams;
      if (params.get('review')) {
        if (!isAdmin(uid)) throw forbidden('Only Prelude admins can review managed campaigns.');
        return res.status(200).json({ campaigns: (await listManagedReviews()).map(shapeReview) });
      }
      const id = params.get('id');
      let { campaign, token, managed } = await loadCampaign(uid, id);
      // Back from Stripe Checkout before the webhook landed: settle it now
      if (managed?.review_status === 'payment' && managed.stripe_session_id && await settleCheckout(managed)) {
        ({ campaign, managed } = await loadCampaign(uid, id));
      }
      const report = await campaignReport(id, token, campaign);
      // Keep a daily copy for later analysis; never fails the read
      saveReportSnapshot(managed ? managed.user_id : uid, id, !!managed, { status: campaign.status, effectiveStatus: campaign.effective_status, ...report })
        .catch(err => console.warn('[meta-campaign] snapshot not saved', err.message));
      return res.status(200).json({
        status: campaign.status,
        effectiveStatus: campaign.effective_status,
        ...(managed ? {
          managed: true,
          review: managed.review_status,
          prepay: prepayEnabled(),
          paid: managed.paid_at ? { cents: managed.paid_cents, at: managed.paid_at } : null,
          quote: prepayEnabled() && !managed.paid_at ? safeQuote(managed) : null,
        } : {}),
        ...report,
      });
    }

    if (req.method === 'POST') {
      const { id, status } = await readBody(req);
      if (!['ACTIVE', 'PAUSED', 'DECLINED'].includes(status)) {
        return res.status(400).json({ error: "status must be 'ACTIVE', 'PAUSED' or 'DECLINED'" });
      }
      const { token, managed } = await loadCampaign(uid, id);
      const admin = isAdmin(uid);

      if (status === 'DECLINED') {
        if (!managed || !admin) throw forbidden('Only Prelude admins can decline a managed campaign.');
        await setManagedReview(id, 'declined', uid);
        return res.status(200).json({ ok: true, status: 'PAUSED', review: 'declined' });
      }

      if (status === 'ACTIVE') {
        // Prelude's card pays Meta for managed campaigns: the owner pays up front (Stripe
        // prepay) or asks for review; an admin can turn it on directly.
        if (managed && !admin && !managed.paid_at) {
          if (!prepayEnabled()) {
            await setManagedReview(id, 'requested');
            return res.status(200).json({ ok: true, status: 'PAUSED', review: 'requested' });
          }
          const quote = prepayQuote(managed);
          // Reuse an open checkout so two clicks can't take two payments
          if (managed.stripe_session_id) {
            const open = await getCheckout(managed.stripe_session_id).catch(() => null);
            if (open?.payment_status === 'paid' && await settleCheckout(managed, open)) {
              return res.status(200).json({ ok: true, status: 'ACTIVE', review: 'approved' });
            }
            if (open?.status === 'open' && open.amount_total === quote.totalCents) {
              return res.status(200).json({ ok: true, status: 'PAUSED', review: 'payment', checkoutUrl: open.url, quote });
            }
          }
          const back = `${origin(req)}/app/campaigns/${encodeURIComponent(managed.directive_id || '')}`;
          const session = await createCheckout({
            campaign: managed, quote, successUrl: `${back}?paid=1`, cancelUrl: `${back}?paid=0`,
          });
          await setManagedCheckout(id, session.id);
          return res.status(200).json({ ok: true, status: 'PAUSED', review: 'payment', checkoutUrl: session.url, quote });
        }
        await activateCampaign(id, token);
        if (managed && !managed.paid_at) await setManagedReview(id, 'approved', uid);
        return res.status(200).json({ ok: true, status, ...(managed ? { review: 'approved' } : {}) });
      }

      await graph('POST', id, token, { status });
      return res.status(200).json({ ok: true, status });
    }

    res.statusCode = 405;
    return res.end();
  } catch (err) {
    return sendError(res, err);
  }
}
