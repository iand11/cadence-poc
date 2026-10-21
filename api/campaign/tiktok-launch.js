// POST /api/campaign/tiktok-launch — turn a TikTok directive into a real, DISABLED (paused)
// Smart+ campaign → ad group → ad. TikTok stops accepting the legacy manual-flow create
// calls for non-Search campaigns on 2027-01-01, so only the /smart_plus/* endpoints are used.
//
// Two kinds of ad, both sending people to creative.trackUrl (the smart link):
//   • Spark Ad: creative.postId (TikTok item id) — promotes an artist's existing post as the
//     artist. It runs as either
//       – the post's Spark Ads code (creative.sparkCode, made by the artist in the TikTok app), or
//       – a TikTok account linked to the ad account (TT_USER / BC_AUTH_TT identity) that owns it.
//   • New video ad: creative.videoUrl (from /api/ad-videos), uploaded to the ad account's video
//     library, running as a TikTok account linked to the ad account (creative.identityId, or the
//     only one).
//
//   body: { directive }              → 200 { platformCampaignId, platformAdGroupId, platformAdId,
//                                            advertiserId, advertiserName, identityName }
//   body: { directive, check: true } → 200 { ready: true, advertiserId, advertiserName, identityName }
//          without creating anything (gates "Submit for Approval").
//   409 { code } when something must be fixed first: not_configured | not_connected |
//        no_ad_account | spark_code (the post needs the artist's Spark Ads code) |
//        no_identity | choose_identity
//
// Everything is created DISABLE; nothing spends until the user goes live through
// /api/campaign/tiktok-campaign. If a step fails, the campaign is deleted again.
import crypto from 'node:crypto';
import { getUid, readBody, sendError, needs } from '../lib/meta.js';
import {
  tt, ttUpload, requireConnection, advertiserFor, ageGroups, requestId, itemIdFrom, COUNTRY_LOCATION_IDS,
} from '../lib/tiktok.js';
import { adVideoId, getAdVideo, getAdVideoInfo, setMetaVideoId } from '../lib/ad-videos.js';

const MAX_BUDGET = Number(process.env.TIKTOK_MAX_BUDGET || 10000);
// TikTok's floors (USD): an ad group needs more than $20 a day; a lifetime budget needs
// $20 × the days it runs (ads.tiktok.com/help/article/budget)
const MIN_DAILY = 20;
const DAY = 86400000;

const CTA_TYPES = {
  'Listen Now': 'LISTEN_NOW',
  'Learn More': 'LEARN_MORE',
  'Watch Now': 'WATCH_NOW',
  'Shop Now': 'SHOP_NOW',
};

function bad(message) {
  return Object.assign(new Error(message), { status: 400 });
}

const isHttpUrl = (u) => /^https?:\/\/\S+$/i.test(String(u || ''));

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

/** TikTok's time format, "YYYY-MM-DD HH:MM:SS". */
const ttTime = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

/** TikTok accounts the ad account can run ads as. */
async function linkedIdentities(token, advertiserId) {
  const data = await tt('GET', 'identity/get/', token, { advertiser_id: advertiserId, page_size: 100 });
  return (data.identity_list || data.list || [])
    .filter(i => i.identity_type === 'TT_USER' || i.identity_type === 'BC_AUTH_TT')
    .map(i => ({ id: i.identity_id, type: i.identity_type, name: i.display_name || i.identity_id, bcId: i.identity_authorized_bc_id || null }));
}

/** Which identity a Spark Ad runs as, after checking it can promote the post. */
async function sparkIdentity(token, advertiserId, creative, artistName) {
  const itemId = itemIdFrom(creative.postId);
  if (!itemId) throw bad('This TikTok post has no id. Pick it again.');

  if (creative.sparkCode) {
    const info = await tt('GET', 'tt_video/info/', token, { advertiser_id: advertiserId, auth_code: creative.sparkCode });
    if (String(info.item_info?.item_id) !== itemId) {
      throw needs('spark_code', "That Spark Ads code is for a different post. Ask the artist for this post's code.");
    }
    return {
      itemId,
      identity: { id: info.user_info?.identity_id, type: info.user_info?.identity_type || 'AUTH_CODE', name: info.user_info?.tiktok_name || null },
      authCode: creative.sparkCode,
    };
  }

  // A TikTok account linked to the ad account can promote its own posts without a code
  for (const identity of await linkedIdentities(token, advertiserId)) {
    try {
      await tt('GET', 'identity/video/info/', token, {
        advertiser_id: advertiserId, identity_type: identity.type, identity_id: identity.id, item_id: itemId,
        identity_authorized_bc_id: identity.bcId || undefined,
      });
      return { itemId, identity };
    } catch {
      // not this account's post
    }
  }
  throw needs('spark_code', `To boost this post, ${artistName || 'the artist'} has to allow it: in the TikTok app, open the post → ⋯ → Ad settings → turn on Ad authorization → Generate code, and paste the code here.`);
}

/** Which TikTok account a new video ad runs as. */
async function videoIdentity(token, advertiserId, creative, artistName) {
  const identities = await linkedIdentities(token, advertiserId);
  if (creative.identityId) {
    const chosen = identities.find(i => i.id === creative.identityId);
    if (chosen) return chosen;
  }
  if (identities.length === 1) return identities[0];
  if (!identities.length) {
    throw needs('no_identity', `New TikTok ads run as a TikTok account. Link ${artistName ? `${artistName}'s` : "the artist's"} TikTok account to the ad account in TikTok Ads Manager (or Business Center), or boost one of their posts instead.`);
  }
  const name = String(artistName || '').toLowerCase().replace(/\s+/g, '');
  const match = identities.filter(i => name && String(i.name).toLowerCase().replace(/\s+/g, '').includes(name));
  if (match.length === 1) return match[0];
  throw needs('choose_identity', 'Choose which TikTok account this ad runs as.', { identities });
}

/** Upload the ad video to the ad account's library once; the TikTok video id is remembered per ad account. */
async function uploadVideo(token, advertiserId, videoUrl, uid) {
  const video = await getAdVideo(adVideoId(videoUrl));
  if (!video || video.user_id !== uid) throw bad('The ad video is missing. Upload it again.');
  const key = `tiktok:${advertiserId}`;
  if (video.meta_videos?.[key]) return video.meta_videos[key];
  const bytes = video.bytes;
  const ext = (video.name || '').match(/\.\w+$/)?.[0] || '.mp4';
  const data = await ttUpload('file/video/ad/upload/', token, {
    advertiser_id: advertiserId,
    upload_type: 'UPLOAD_BY_FILE',
    video_signature: crypto.createHash('md5').update(bytes).digest('hex'),
    // File names must be unique per ad account
    file_name: `prelude-${video.id}${ext}`,
  }, 'video_file', bytes, video.name || `ad-video${ext}`);
  const videoId = (Array.isArray(data) ? data[0] : data.list?.[0] || data)?.video_id;
  if (!videoId) throw Object.assign(new Error('TikTok did not return a video id.'), { status: 502 });
  await setMetaVideoId(video.id, key, videoId);
  return videoId;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end();
  }

  let token;
  let advertiserId;
  let campaignId;
  try {
    const uid = await getUid(req);
    const conn = await requireConnection(uid);
    token = conn.token;
    const { directive, check } = await readBody(req);
    if (!directive || directive.platform !== 'tiktok') throw bad('A TikTok directive is required.');
    const c = directive.creative || {};
    const isSpark = !!c.postId;

    const advertiser = advertiserFor(conn.selection, directive.advertiserId);
    if (!advertiser) {
      throw needs('no_ad_account', (conn.selection.advertisers || []).length
        ? 'Choose which TikTok ad account campaigns run in (Ad Accounts).'
        : 'Your TikTok connection has no ad accounts. Reconnect and include an ad account.');
    }
    advertiserId = advertiser.id;

    const amount = Number(directive.budget?.amount);
    if (!(amount > 0)) throw bad('Set a budget greater than 0.');
    if (amount > MAX_BUDGET) throw bad(`Budget is above the ${MAX_BUDGET.toLocaleString()} limit for a single campaign.`);
    const daily = directive.budget?.period === 'daily';
    const { startDate, endDate } = directive.schedule || {};
    if (!daily && !endDate) throw bad('A lifetime budget needs an end date.');
    const now = Date.now();
    const start = new Date(Math.max(now + 15 * 60000, startDate ? new Date(`${startDate}T00:00:00Z`).getTime() : 0));
    const end = endDate ? new Date(`${endDate}T23:59:59Z`) : null;
    if (end && end <= start) throw bad('The end date has to be after the start.');
    const days = end ? Math.max(1, Math.ceil((end - start) / DAY)) : 1;
    if (daily && amount < MIN_DAILY) throw bad(`TikTok needs a daily budget of at least $${MIN_DAILY}.`);
    if (!daily && amount < MIN_DAILY * days) {
      throw bad(`TikTok needs at least $${MIN_DAILY} a day: $${(MIN_DAILY * days).toLocaleString()} for ${days} days. Raise the budget or shorten the dates.`);
    }
    if (!isHttpUrl(c.trackUrl)) throw bad('Add where the ad sends people (the smart link).');

    let identity;
    let itemId = null;
    if (isSpark) {
      ({ identity, itemId } = await sparkIdentity(token, advertiserId, c, directive.artistName));
    } else {
      const info = await getAdVideoInfo(adVideoId(c.videoUrl));
      if (!info || info.user_id !== uid || !info.complete) throw bad('Add a video for the ad (upload it again if it was removed).');
      identity = await videoIdentity(token, advertiserId, c, directive.artistName);
    }

    if (check) {
      return res.status(200).json({
        ready: true, advertiserId, advertiserName: advertiser.name, identityName: identity.name || null,
      });
    }

    // Spark code: bind the post to the ad account (TikTok answers "already" on a repeat)
    if (isSpark && c.sparkCode) {
      await tt('POST', 'tt_video/authorize/', token, { advertiser_id: advertiserId, auth_code: c.sparkCode })
        .catch(err => { if (!/already|exist/i.test(err.message)) throw err; });
    }
    // Video first: if TikTok rejects the file, nothing else has been created yet
    const videoId = isSpark ? null : await uploadVideo(token, advertiserId, c.videoUrl, uid);

    const name = `Prelude · ${directive.artistName || directive.artistSlug || 'Ad'} · ${isSpark ? 'Spark' : 'Ad'} · ${new Date().toISOString().slice(0, 10)}`;

    // 1. Campaign (budget lives on the ad group)
    const campaign = await tt('POST', 'smart_plus/campaign/create/', token, {
      advertiser_id: advertiserId,
      request_id: requestId(),
      campaign_name: name,
      objective_type: 'TRAFFIC',
      budget_mode: 'BUDGET_MODE_INFINITE',
      operation_status: 'DISABLE',
    });
    campaignId = String(campaign.campaign_id);

    // 2. Ad group: link clicks to the smart link, on TikTok only
    const locationIds = [...new Set((directive.audience?.locations || [])
      .map(code => COUNTRY_LOCATION_IDS[String(code).toUpperCase()]).filter(Boolean))];
    const adGroup = await tt('POST', 'smart_plus/adgroup/create/', token, {
      advertiser_id: advertiserId,
      request_id: requestId(),
      campaign_id: campaignId,
      adgroup_name: name,
      promotion_type: 'WEBSITE',
      optimization_goal: 'CLICK',
      billing_event: 'CPC',
      bid_type: 'BID_TYPE_NO_BID',
      budget_mode: daily ? 'BUDGET_MODE_DAY' : 'BUDGET_MODE_TOTAL',
      budget: amount,
      schedule_type: end ? 'SCHEDULE_START_END' : 'SCHEDULE_FROM_NOW',
      schedule_start_time: ttTime(start),
      schedule_end_time: end ? ttTime(end) : undefined,
      placement_type: 'PLACEMENT_TYPE_NORMAL',
      placements: ['PLACEMENT_TIKTOK'],
      targeting_spec: {
        location_ids: locationIds.length ? locationIds : [COUNTRY_LOCATION_IDS.US],
        age_groups: ageGroups(directive.audience?.ageRange),
      },
      operation_status: 'DISABLE',
    });
    const adGroupId = String(adGroup.adgroup_id);

    // 3. Ad: the post (Spark) or the uploaded video, as the chosen TikTok account
    const destination = withCampaign(c.trackUrl, directive.id);
    const creativeInfo = isSpark
      ? { ad_format: 'SINGLE_VIDEO', identity_type: identity.type, identity_id: identity.id, tiktok_item_id: itemId }
      : { ad_format: 'SINGLE_VIDEO', identity_type: identity.type, identity_id: identity.id, video_info: { video_id: videoId } };
    if (identity.bcId) creativeInfo.identity_authorized_bc_id = identity.bcId;
    const ad = await tt('POST', 'smart_plus/ad/create/', token, {
      advertiser_id: advertiserId,
      adgroup_id: adGroupId,
      ad_name: name,
      creative_list: [{ creative_info: creativeInfo }],
      // A Spark Ad shows the post's own caption
      ad_text_list: isSpark ? undefined : [{ ad_text: (c.headline || `New music from ${directive.artistName || 'the artist'}`).slice(0, 100) }],
      call_to_action_list: [{ call_to_action: CTA_TYPES[c.callToAction] || 'LISTEN_NOW' }],
      landing_page_url_list: [{ landing_page_url: destination }],
      operation_status: 'DISABLE',
    });
    const adId = String(ad.smart_plus_ad_id || ad.ad_id || ad.ad_ids?.[0] || '');

    return res.status(200).json({
      platformCampaignId: campaignId,
      platformAdGroupId: adGroupId,
      platformAdId: adId || null,
      advertiserId,
      advertiserName: advertiser.name,
      identityName: identity.name || null,
    });
  } catch (err) {
    // Roll back so a failed launch never leaves a campaign in the ad account
    if (token && campaignId) {
      await tt('POST', 'smart_plus/campaign/status/update/', token, {
        advertiser_id: advertiserId, campaign_ids: [campaignId], operation_status: 'DELETE',
      }).catch(() => {});
    }
    return sendError(res, err);
  }
}
