// POST /api/campaign/meta-launch — turn a Meta directive into a real, PAUSED Meta campaign.
//
// Two kinds of ad, both running as the artist's Instagram account (and its linked Page):
//   • Boost: creative.postId (+ permalink) — promotes an existing Instagram post.
//   • New ad: creative.igUserId + trackUrl (destination) + either
//       – images (uploads or URLs, in order): one makes a single-image link ad, 2–10 a carousel;
//       – a video (creative.type 'video', creative.videoUrl from /api/ad-videos): uploaded to the
//         ad account's video library in chunks, then used once Meta has processed it.
//     All get headline, description and call to action.
//
//   body: { directive }            → 200 { platformCampaignId, platformAdSetId, platformAdId,
//                                          platformCreativeId, adAccountId, igUsername }
//   body: { directive, check: true } → 200 { ready: true, igUsername, adAccountId, adAccountName }
//         without creating anything. Used to gate "Submit for Approval".
//   409 { code } when something must be fixed first: not_configured | not_connected |
//         post_not_found (artist's IG account not shared) | no_ad_account | ineligible |
//         video_processing (Meta hasn't finished the video yet; retrying reuses the upload)
//
// The ad account is the one the user assigned to that Instagram account in Ad Accounts,
// so each artist's ads run (and bill) in that artist's ad account. An Instagram account
// assigned to Prelude's ad account (managed: artists without one) runs new ads there with
// Prelude's token; boosts stay in the artist's own ad account. Managed campaigns are
// recorded in meta_managed_campaigns and only go live after Prelude approves them. Campaign → Ad Set →
// Ad Creative → Ad are all created paused; nothing spends until the user goes live
// through /api/campaign/meta-campaign. If any step fails, what was created is deleted.
import {
  graph, graphUpload, getUid, requireConnection, readBody, sendError, needs, adAccountFor, findInstagramPost,
  listInstagramAccounts, isManaged, preludeAccount, saveManagedCampaign, MANAGED_ACCOUNT_NAME,
} from '../lib/meta.js';
import { adImageId, getAdImage } from '../lib/ad-images.js';
import { prepayEnabled } from '../lib/stripe.js';
import { adVideoId, getAdVideo, getAdVideoInfo, setMetaVideoId } from '../lib/ad-videos.js';

// Server-side ceiling per campaign (account currency, major units)
const MAX_BUDGET = Number(process.env.META_MAX_BUDGET || 10000);
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const MAX_CAROUSEL = 10;
// How long to wait for Meta to process an uploaded video before asking the user to retry
const VIDEO_WAIT_MS = Number(process.env.META_VIDEO_WAIT_MS || 40000);
const VIDEO_POLL_MS = 3000;

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
async function resolveIdentity(token, directive, uid) {
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
  if (creative.type === 'video') {
    const video = await getAdVideoInfo(adVideoId(creative.videoUrl));
    if (!video || video.user_id !== uid || !video.complete) throw bad('Add a video for the ad (upload it again if it was removed).');
  } else {
    const images = adImages(creative);
    if (!images.length) throw bad('Add at least one image for the ad.');
    if (images.length > MAX_CAROUSEL) throw bad(`An Instagram carousel can have at most ${MAX_CAROUSEL} images.`);
    if (images.some(u => !adImageId(u) && !isHttpUrl(u))) throw bad('One of the ad images is not a valid upload or URL.');
  }
  if (!isHttpUrl(creative.trackUrl)) throw bad('Add a destination URL (where the ad sends people).');
  return { account, mediaId: null };
}

/** The ad's images in carousel order (`creative.images`), or the single legacy `imageUrl`. */
function adImages(creative) {
  const list = Array.isArray(creative?.images) ? creative.images : [creative?.imageUrl];
  return list.filter(Boolean);
}

/** Read the ad image (an upload, or any URL) and add it to the ad account's image library. */
async function uploadImage(act, token, imageUrl, uid) {
  const uploadId = adImageId(imageUrl);
  if (uploadId) {
    const image = await getAdImage(uploadId);
    if (!image || image.user_id !== uid) throw bad('One of the ad images is missing. Upload it again.');
    return hashFor(act, token, image.bytes);
  }
  const res = await fetch(imageUrl);
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) throw bad(`Couldn't download the ad image (${res.status}). Check the image URL.`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw bad('The ad image is larger than 30 MB.');
  return hashFor(act, token, buf);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Put the ad video in the ad account's video library (chunked upload session), wait for
 * Meta to process it, and pick its thumbnail. The Meta video id is remembered per ad
 * account, so retrying after `video_processing` only polls again.
 */
async function uploadVideo(act, token, videoUrl, uid, title) {
  const video = await getAdVideo(adVideoId(videoUrl));
  if (!video || video.user_id !== uid) throw bad('The ad video is missing. Upload it again.');

  let videoId = video.meta_videos?.[act];
  if (!videoId) {
    const bytes = video.bytes;
    const session = await graph('POST', `${act}/advideos`, token, { upload_phase: 'start', file_size: bytes.length });
    let start = Number(session.start_offset);
    let end = Number(session.end_offset);
    while (start < end) {
      const part = await graphUpload(`${act}/advideos`, token, {
        upload_phase: 'transfer', upload_session_id: session.upload_session_id, start_offset: start,
      }, 'video_file_chunk', bytes.subarray(start, end), video.name || 'ad-video.mp4');
      start = Number(part.start_offset);
      end = Number(part.end_offset);
    }
    await graph('POST', `${act}/advideos`, token, { upload_phase: 'finish', upload_session_id: session.upload_session_id, title });
    videoId = session.video_id;
    await setMetaVideoId(video.id, act, videoId);
  }

  const deadline = Date.now() + VIDEO_WAIT_MS;
  for (;;) {
    const { status } = await graph('GET', videoId, token, { fields: 'status' });
    if (status?.video_status === 'ready') break;
    if (status?.video_status === 'error') throw bad('Meta couldn\'t process the video. Try another file (MP4 or MOV works best).');
    if (Date.now() + VIDEO_POLL_MS > deadline) {
      throw needs('video_processing', 'Meta is still processing the video. Try again in a minute.');
    }
    await sleep(VIDEO_POLL_MS);
  }

  const thumbs = await graph('GET', `${videoId}/thumbnails`, token, {});
  const thumb = (thumbs.data || []).find(t => t.is_preferred) || (thumbs.data || [])[0];
  if (!thumb?.uri) throw Object.assign(new Error('Meta did not return a thumbnail for the video.'), { status: 502 });
  return { videoId, thumbnailUrl: thumb.uri };
}

async function hashFor(act, token, buf) {
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
  let token; // the token that owns the ad account (the user's, or Prelude's when managed)
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

    // 1. The Instagram account it runs as (+ the post for a boost), seen through the user's token
    const { account, mediaId } = await resolveIdentity(conn.token, directive, uid);

    // 2. The ad account assigned to that Instagram account (or Prelude's, when managed)
    const managed = isManaged(conn.selection, account.igUserId);
    let act;
    if (managed) {
      if (isBoost) {
        throw needs('managed_boost', `Prelude's ad account runs new posts only. Create a new post for @${account.username}, or assign their own ad account to boost.`);
      }
      if (prepayEnabled() && daily && !endDate) {
        throw bad('Add an end date: ads in Prelude\'s ad account are paid up front, so the total budget has to be known.');
      }
      ({ act, token } = preludeAccount());
    } else {
      act = adAccountFor(conn.selection, account.igUserId);
      token = conn.token;
    }
    if (!act) {
      throw needs('no_ad_account', `Choose which ad account @${account.username}'s ads run in, or let Prelude run them (Ad Accounts).`, { igUsername: account.username });
    }

    if (check) {
      return res.status(200).json({
        ready: true,
        managed,
        igUsername: account.username,
        adAccountId: act,
        adAccountName: managed ? MANAGED_ACCOUNT_NAME : conn.selection.accountMap[account.igUserId].adAccountName || null,
      });
    }
    const igUserId = account.igUserId;
    const name = `Prelude · ${directive.artistName || directive.artistSlug || 'Ad'} · ${isBoost ? 'Boost' : 'Ad'} · ${new Date().toISOString().slice(0, 10)}`;
    const goal = goalFor(directive.objective, isBoost);
    const c = directive.creative;
    const isVideo = !isBoost && c.type === 'video';

    // Video first: if Meta needs longer to process it, nothing else has been created yet
    const video = isVideo ? await uploadVideo(act, token, c.videoUrl, uid, c.headline || name) : null;

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

    // 5. Creative: the existing post for a boost, or images / a video + link for a new ad
    const destination = isBoost ? null : withCampaign(c.trackUrl, directive.id);
    const cta = { type: CTA_TYPES[c.callToAction] || 'LEARN_MORE', value: { link: destination } };
    let linkData = null;
    let videoData = null;
    if (isVideo) {
      videoData = {
        video_id: video.videoId,
        image_url: video.thumbnailUrl,
        title: c.headline || undefined,
        message: c.description || undefined,
        call_to_action: cta,
      };
    } else if (!isBoost) {
      const hashes = [];
      for (const url of adImages(c)) hashes.push(await uploadImage(act, token, url, uid));
      linkData = hashes.length === 1
        ? { image_hash: hashes[0], link: destination, name: c.headline || undefined, message: c.description || undefined, call_to_action: cta }
        // Carousel: one card per image, kept in the order the user set
        : {
          link: destination,
          message: c.description || undefined,
          child_attachments: hashes.map(hash => ({ image_hash: hash, link: destination, name: c.headline || undefined, call_to_action: cta })),
          multi_share_optimized: false,
          multi_share_end_card: false,
        };
    }
    const creative = await graph('POST', `${act}/adcreatives`, token, isBoost
      ? { name, object_id: account.pageId, instagram_user_id: igUserId, source_instagram_media_id: mediaId }
      : { name, object_story_spec: { page_id: account.pageId, instagram_user_id: igUserId, ...(videoData ? { video_data: videoData } : { link_data: linkData }) } });
    created.creativeId = creative.id;

    // 6. Ad
    const ad = await graph('POST', `${act}/ads`, token, {
      name,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    });

    if (managed) {
      await saveManagedCampaign({
        campaignId: campaign.id, userId: uid, directiveId: directive.id || null,
        artistName: directive.artistName || directive.artistSlug || null,
        igUserId, igUsername: account.username || null,
        budget: amount, period: daily ? 'daily' : 'lifetime', startDate: startDate || null, endDate,
      });
    }

    return res.status(200).json({
      managed,
      platformCampaignId: campaign.id,
      platformAdSetId: adSet.id,
      platformAdId: ad.id,
      platformCreativeId: creative.id,
      adAccountId: act,
      igUsername: account.username || null,
    });
  } catch (err) {
    // Roll back partial work so a failed launch never leaves objects in the ad account.
    if (token && created.campaignId) {
      await graph('DELETE', created.campaignId, token).catch(() => {});
    }
    if (token && created.creativeId) {
      await graph('DELETE', created.creativeId, token).catch(() => {});
    }
    return sendError(res, err);
  }
}
