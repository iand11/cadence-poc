// POST /api/campaign/meta-launch — turn a Meta directive into a real, PAUSED Meta campaign.
//
// Two kinds of ad, both running as the artist's Instagram account (and its linked Page):
//   • Boost: creative.postId (+ permalink) — promotes an existing Instagram post.
//   • New ad: creative.igUserId + imageUrl + trackUrl (destination) — Prelude uploads the
//     image and builds a link ad with headline, description and call to action.
//
//   body: { directive }            → 200 { platformCampaignId, platformAdSetId, platformAdId,
//                                          platformCreativeId, adAccountId, igUsername }
//   body: { directive, check: true } → 200 { ready: true, igUsername, adAccountId, adAccountName }
//         without creating anything. Used to gate "Submit for Approval".
//   409 { code } when something must be fixed first: not_configured | not_connected |
//         post_not_found (artist's IG account not shared) | no_ad_account | ineligible
//
// The ad account is the one the user assigned to that Instagram account in Ad Accounts,
// so each artist's ads run (and bill) in that artist's ad account. Campaign → Ad Set →
// Ad Creative → Ad are all created paused; nothing spends until the user goes live
// through /api/campaign/meta-campaign. If any step fails, what was created is deleted.
import {
  graph, getUid, requireConnection, readBody, sendError, needs, adAccountFor, findInstagramPost,
  listInstagramAccounts,
} from '../lib/meta.js';

// Server-side ceiling per campaign (account currency, major units)
const MAX_BUDGET = Number(process.env.META_MAX_BUDGET || 10000);
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

// Our location codes are mostly ISO-3166 alpha-2; Meta wants GB, not UK.
const COUNTRY_FIX = { UK: 'GB' };

// Builder call-to-action labels → Meta CTA types
const CTA_TYPES = {
  'Listen Now': 'LISTEN_NOW',
  'Learn More': 'LEARN_MORE',
  'Watch Now': 'WATCH_MORE',
  'Shop Now': 'SHOP_NOW',
};

function goalFor(objective, isBoost) {
  if (objective === 'awareness' || objective === 'reach') {
    return { objective: 'OUTCOME_AWARENESS', optimization_goal: 'REACH' };
  }
  // A boost earns engagement on the post; a new ad sends people to the destination link.
  return isBoost
    ? { objective: 'OUTCOME_ENGAGEMENT', optimization_goal: 'POST_ENGAGEMENT', destination_type: 'ON_POST' }
    : { objective: 'OUTCOME_TRAFFIC', optimization_goal: 'LINK_CLICKS', destination_type: 'WEBSITE' };
}

function bad(message) {
  return Object.assign(new Error(message), { status: 400 });
}

/** Tag a Prelude smart link with the campaign so its views and clicks are attributed to it. */
function withCampaign(url, campaignId) {
  try {
    const u = new URL(url);
    if (!campaignId || !/^\/l\/[\w-]+\/?$/.test(u.pathname)) return url;
    u.searchParams.set('c', campaignId);
    return u.toString();
  } catch {
    return url;
  }
}

const isHttpUrl = (u) => /^https?:\/\/\S+$/i.test(String(u || ''));

/** Which Instagram account (and Page) the ad runs as, plus the post for a boost. */
async function resolveIdentity(token, directive) {
  const creative = directive.creative || {};
  if (creative.postId) {
    const found = await findInstagramPost(token, {
      permalink: creative.permalink || creative.trackUrl,
      postId: creative.postId,
    });
    if (!found) {
      throw needs('post_not_found', `Prelude can't see ${directive.artistName || 'this artist'}'s Instagram account. In Ad Accounts, use "Add or change accounts" and include their Instagram account and Facebook Page.`);
    }
    const { eligibility } = found;
    if (eligibility && eligibility.eligible_to_boost === false) {
      throw needs('ineligible', `Instagram won't allow this post to be boosted${eligibility.boost_ineligible_reason ? `: ${eligibility.boost_ineligible_reason}` : '.'}`);
    }
    return { account: found.account, mediaId: found.mediaId };
  }

  if (!creative.igUserId) {
    throw needs('post_not_found', 'Choose which Instagram account this ad runs as.');
  }
  const account = (await listInstagramAccounts(token)).find(a => a.igUserId === String(creative.igUserId));
  if (!account) {
    throw needs('post_not_found', 'That Instagram account is no longer shared with Prelude. Reconnect it in Ad Accounts.');
  }
  if (directive.creative?.type === 'video') {
    throw bad('Video ads on Meta aren\'t supported yet. Use an image, or boost an existing video post.');
  }
  if (!isHttpUrl(creative.imageUrl)) throw bad('Add an image URL for the ad.');
  if (!isHttpUrl(creative.trackUrl)) throw bad('Add a destination URL (where the ad sends people).');
  return { account, mediaId: null };
}

/** Download the ad image and upload it to the ad account's image library. */
async function uploadImage(act, token, imageUrl) {
  const res = await fetch(imageUrl);
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) throw bad(`Couldn't download the ad image (${res.status}). Check the image URL.`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw bad('The ad image is larger than 30 MB.');
  const uploaded = await graph('POST', `${act}/adimages`, token, { bytes: buf.toString('base64') });
  const hash = Object.values(uploaded.images || {})[0]?.hash;
  if (!hash) throw Object.assign(new Error('Meta did not return an image hash.'), { status: 502 });
  return hash;
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

    const isBoost = !!directive.creative?.postId;
    const amount = Number(directive.budget?.amount);
    if (!(amount > 0)) throw bad('Set a budget greater than 0.');
    if (amount > MAX_BUDGET) throw bad(`Budget is above the ${MAX_BUDGET.toLocaleString()} limit for a single boost.`);
    const daily = directive.budget?.period === 'daily';
    const endDate = directive.schedule?.endDate;
    if (!daily && !endDate) throw bad('A lifetime budget needs an end date.');

    const token = conn.token;

    // 1. The Instagram account it runs as (+ the post for a boost)
    const { account, mediaId } = await resolveIdentity(token, directive);

    // 2. The ad account assigned to that Instagram account
    const act = adAccountFor(conn.selection, account.igUserId);
    if (!act) {
      throw needs('no_ad_account', `Choose which ad account @${account.username}'s ads run in (Ad Accounts).`, { igUsername: account.username });
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
    const name = `Prelude · ${directive.artistName || directive.artistSlug || 'Ad'} · ${isBoost ? 'Boost' : 'Ad'} · ${new Date().toISOString().slice(0, 10)}`;
    const goal = goalFor(directive.objective, isBoost);

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

    // 5. Creative: the existing post for a boost, or an uploaded image + link for a new ad
    const c = directive.creative;
    const destination = isBoost ? null : withCampaign(c.trackUrl, directive.id);
    const creative = await graph('POST', `${act}/adcreatives`, token, isBoost
      ? { name, object_id: account.pageId, instagram_user_id: igUserId, source_instagram_media_id: mediaId }
      : {
        name,
        object_story_spec: {
          page_id: account.pageId,
          instagram_user_id: igUserId,
          link_data: {
            image_hash: await uploadImage(act, token, c.imageUrl),
            link: destination,
            name: c.headline || undefined,
            message: c.description || undefined,
            call_to_action: { type: CTA_TYPES[c.callToAction] || 'LEARN_MORE', value: { link: destination } },
          },
        },
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
    // Roll back partial work so a failed launch never leaves objects in the ad account.
    if (conn && created.campaignId) {
      await graph('DELETE', created.campaignId, conn.token).catch(() => {});
    }
    if (conn && created.creativeId) {
      await graph('DELETE', created.creativeId, conn.token).catch(() => {});
    }
    return sendError(res, err);
  }
}
