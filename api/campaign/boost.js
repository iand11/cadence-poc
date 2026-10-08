// POST /api/campaign/boost — turn a Meta directive into a real, PAUSED Meta campaign
// that boosts an existing Instagram post.
//
//   body: { directive }   (needs creative.postId + permalink; objective, budget, schedule, audience)
//   200 → { platformCampaignId, platformAdSetId, platformAdId, platformCreativeId,
//           adAccountId, igUsername }
//   body: { directive, check: true } → 200 { ready: true, igUsername, adAccountId, adAccountName }
//         without creating anything. Used to gate "Submit for Approval".
//   409 { code } when something must be fixed first: not_configured | not_connected |
//         post_not_found (artist's IG account not shared) | no_ad_account | ineligible
//
// The ad account is the one the user assigned to the post's Instagram account in
// Ad Accounts, so each artist's boosts run (and bill) in that artist's ad account.
// Creates Campaign → Ad Set → Ad Creative (source_instagram_media_id) → Ad, all paused.
// Nothing spends until the user goes live through /api/campaign/meta-campaign.
// If any step fails, the campaign created so far is deleted.
import {
  graph, getUid, requireConnection, readBody, sendError, needs, adAccountFor, findInstagramPost,
} from '../lib/meta.js';

// Server-side ceiling per boost (account currency, major units)
const MAX_BUDGET = Number(process.env.META_MAX_BUDGET || 10000);

// Our location codes are mostly ISO-3166 alpha-2; Meta wants GB, not UK.
const COUNTRY_FIX = { UK: 'GB' };

function objectiveFor(objective) {
  if (objective === 'awareness' || objective === 'reach') {
    return { objective: 'OUTCOME_AWARENESS', optimization_goal: 'REACH' };
  }
  return { objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'POST_ENGAGEMENT', destination_type: 'ON_POST' };
}

function bad(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end();
  }

  const created = {};
  let conn;
  try {
    const uid = await getUid(req);
    conn = await requireConnection(uid);
    const { directive, check } = await readBody(req);
    if (!directive || directive.platform !== 'meta') throw bad('A Meta directive is required.');

    const postId = directive.creative?.postId;
    const permalink = directive.creative?.permalink || directive.creative?.trackUrl;
    if (!postId) throw bad('Only boosting an existing Instagram post is supported. Pick a post from the Content tab.');

    const amount = Number(directive.budget?.amount);
    if (!(amount > 0)) throw bad('Set a budget greater than 0.');
    if (amount > MAX_BUDGET) throw bad(`Budget is above the ${MAX_BUDGET.toLocaleString()} limit for a single boost.`);
    const daily = directive.budget?.period === 'daily';
    const endDate = directive.schedule?.endDate;
    if (!daily && !endDate) throw bad('A lifetime budget needs an end date.');

    const token = conn.token;

    // 1. Find the post among the shared Instagram accounts (also gives the linked Page)
    const found = await findInstagramPost(token, { permalink, postId });
    if (!found) {
      throw needs('post_not_found', `Prelude can't see ${directive.artistName || 'this artist'}'s Instagram account. In Ad Accounts, use "Add or change accounts" and include their Instagram account and Facebook Page.`);
    }
    const { mediaId, account, eligibility } = found;

    // 2. Can it be boosted at all (copyrighted music, IGTV, etc. can't)
    if (eligibility && eligibility.eligible_to_boost === false) {
      throw needs('ineligible', `Instagram won't allow this post to be boosted${eligibility.boost_ineligible_reason ? `: ${eligibility.boost_ineligible_reason}` : '.'}`);
    }

    // 3. The ad account assigned to this artist's Instagram account
    const act = adAccountFor(conn.selection, account.igUserId);
    if (!act) {
      throw needs('no_ad_account', `Choose which ad account @${account.username}'s boosts run in (Ad Accounts).`, { igUsername: account.username });
    }

    if (check) {
      return res.status(200).json({
        ready: true,
        igUsername: account.username,
        adAccountId: act,
        adAccountName: conn.selection.accountMap[account.igUserId].adAccountName || null,
      });
    }
    const igUserId = account.igUserId;
    const page = { id: account.pageId };

    const name = `Prelude · ${directive.artistName || directive.artistSlug || 'Boost'} · ${new Date().toISOString().slice(0, 10)}`;
    const goal = objectiveFor(directive.objective);

    // 3. Campaign (ad-set budgets, so budget sharing must be stated explicitly)
    const campaign = await graph('POST', `${act}/campaigns`, token, {
      name,
      objective: goal.objective,
      status: 'PAUSED',
      buying_type: 'AUCTION',
      special_ad_categories: [],
      is_adset_budget_sharing_enabled: false,
    });
    created.campaignId = campaign.id;

    // 4. Ad set
    const countries = (directive.audience?.locations || [])
      .map(c => COUNTRY_FIX[String(c).toUpperCase()] || String(c).toUpperCase())
      .filter(c => /^[A-Z]{2}$/.test(c));
    const [ageMin, ageMax] = directive.audience?.ageRange || [18, 65];
    const today = new Date().toISOString().slice(0, 10);
    const startDate = directive.schedule?.startDate;
    const cents = Math.round(amount * 100);

    const adSet = await graph('POST', `${act}/adsets`, token, {
      name,
      campaign_id: campaign.id,
      status: 'PAUSED',
      billing_event: 'IMPRESSIONS',
      optimization_goal: goal.optimization_goal,
      destination_type: goal.destination_type,
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      ...(daily ? { daily_budget: cents } : { lifetime_budget: cents }),
      start_time: startDate && startDate > today ? `${startDate}T00:00:00` : undefined,
      end_time: endDate ? `${endDate}T23:59:59` : undefined,
      targeting: {
        geo_locations: { countries: countries.length ? countries : ['US'] },
        age_min: Math.max(18, Number(ageMin) || 18),
        age_max: Math.min(65, Number(ageMax) || 65),
        publisher_platforms: ['instagram'],
        targeting_automation: { advantage_audience: 0 },
      },
    });
    created.adSetId = adSet.id;

    // 5. Creative from the existing Instagram post
    const creative = await graph('POST', `${act}/adcreatives`, token, {
      name,
      object_id: page.id,
      instagram_user_id: igUserId,
      source_instagram_media_id: mediaId,
    });
    created.creativeId = creative.id;

    // 6. Ad
    const ad = await graph('POST', `${act}/ads`, token, {
      name,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    });

    return res.status(200).json({
      platformCampaignId: campaign.id,
      platformAdSetId: adSet.id,
      platformAdId: ad.id,
      platformCreativeId: creative.id,
      adAccountId: act,
      igUsername: account.username || null,
    });
  } catch (err) {
    // Roll back partial work so a failed boost never leaves objects in the ad account.
    if (conn && created.campaignId) {
      await graph('DELETE', created.campaignId, conn.token).catch(() => {});
    }
    if (conn && created.creativeId) {
      await graph('DELETE', created.creativeId, conn.token).catch(() => {});
    }
    return sendError(res, err);
  }
}
