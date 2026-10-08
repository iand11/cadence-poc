// POST /api/campaign/boost — turn a Meta directive into a real, PAUSED Meta campaign
// that boosts an existing Instagram post.
//
//   body: { directive }   (needs creative.postId; objective, budget, schedule, audience)
//   200 → { platformCampaignId, platformAdSetId, platformAdId, platformCreativeId,
//           adAccountId, igUsername }
//
// Creates Campaign → Ad Set → Ad Creative (source_instagram_media_id) → Ad, all paused.
// Nothing spends until the user goes live through /api/campaign/meta-campaign.
// If any step fails, the campaign created so far is deleted.
import { graph, graphList, getUid, requireConnection, readBody, sendError } from '../lib/meta.js';

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
    const { directive } = await readBody(req);
    if (!directive || directive.platform !== 'meta') throw bad('A Meta directive is required.');

    const postId = directive.creative?.postId;
    if (!postId) throw bad('Only boosting an existing Instagram post is supported. Pick a post from the Content tab.');

    const amount = Number(directive.budget?.amount);
    if (!(amount > 0)) throw bad('Set a budget greater than 0.');
    if (amount > MAX_BUDGET) throw bad(`Budget is above the ${MAX_BUDGET.toLocaleString()} limit for a single boost.`);
    const daily = directive.budget?.period === 'daily';
    const endDate = directive.schedule?.endDate;
    if (!daily && !endDate) throw bad('A lifetime budget needs an end date.');

    const act = conn.selection.adAccountId;
    const token = conn.token;

    // 1. The post: who owns it and can it be boosted (copyrighted music, IGTV, etc. can't)
    const media = await graph('GET', postId, token, { fields: 'id,owner,username,boost_eligibility_info' });
    const eligibility = media.boost_eligibility_info;
    if (eligibility && eligibility.eligible_to_boost === false) {
      throw bad(`Instagram won't allow this post to be boosted${eligibility.boost_ineligible_reason ? `: ${eligibility.boost_ineligible_reason}` : '.'}`);
    }
    const igUserId = media.owner?.id || directive.creative?.igUserId;

    // 2. The Facebook Page linked to that Instagram account (required as the creative's object_id)
    const pages = await graphList('me/accounts', token, { fields: 'id,instagram_business_account{id,username}' });
    const page = pages.find(p => p.instagram_business_account?.id === igUserId);
    if (!page) {
      throw bad(`Prelude can't see the Facebook Page linked to ${media.username ? `@${media.username}` : 'this Instagram account'}. Reconnect Meta and include that Page and Instagram account.`);
    }

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
      source_instagram_media_id: postId,
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
      igUsername: page.instagram_business_account.username || media.username || null,
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
