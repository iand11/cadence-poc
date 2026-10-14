#!/usr/bin/env node
// Can Prelude run ads for an Instagram account that has no Facebook Page?
//
//   npm run meta:ig-only-test                    try every Instagram account Prelude's business can see
//   npm run meta:ig-only-test -- --ig <username>  try one account
//   npm run meta:ig-only-test -- --keep           leave the paused test campaigns in Ads Manager
//
// Before running: add the artist's Instagram account to Prelude's business with its Instagram
// login (Business Suite → Settings → Accounts → Instagram accounts → Add), then give the
// system user access to it and connect it to Prelude's ad account (same page → Assign people /
// Connected assets).
//
// The script lists the Instagram accounts the business and ad account can use, then for each
// one builds a PAUSED test ad with no page_id: a new image ad, and a boost of its latest post.
// Nothing is turned on, and the test campaigns are deleted at the end unless --keep is given.
// Uses META_PRELUDE_TOKEN, META_APP_SECRET, META_PRELUDE_BUSINESS_ID and
// META_PRELUDE_AD_ACCOUNT_ID from the environment or .env.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const argValue = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const ONLY = argValue('ig')?.replace(/^@/, '').toLowerCase() || null;
const KEEP = process.argv.includes('--keep');

const TOKEN = process.env.META_PRELUDE_TOKEN;
const SECRET = process.env.META_APP_SECRET;
const BUSINESS = process.env.META_PRELUDE_BUSINESS_ID;
const ACT = `act_${String(process.env.META_PRELUDE_AD_ACCOUNT_ID || '').replace(/^act_/, '')}`;
const GRAPH = process.env.META_GRAPH_URL || `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v24.0'}`;

const missing = ['META_PRELUDE_TOKEN', 'META_APP_SECRET', 'META_PRELUDE_BUSINESS_ID', 'META_PRELUDE_AD_ACCOUNT_ID']
  .filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing ${missing.join(', ')} (set them in .env).`);
  process.exit(1);
}

const proof = crypto.createHmac('sha256', SECRET).update(TOKEN).digest('hex');

async function graph(method, p, params = {}) {
  const q = new URLSearchParams({ access_token: TOKEN, appsecret_proof: proof });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) q.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  const url = `${GRAPH}/${p}`;
  const res = method === 'GET' || method === 'DELETE'
    ? await fetch(`${url}?${q}`, { method })
    : await fetch(url, { method, body: q });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error || {};
    const detail = [e.error_user_title, e.error_user_msg].filter(Boolean).join(': ');
    throw Object.assign(new Error(`${e.message || `HTTP ${res.status}`}${detail ? ` (${detail})` : ''}`), { code: e.code, subcode: e.error_subcode });
  }
  return body;
}

const errText = (err) => `${err.message}${err.code ? ` [code ${err.code}${err.subcode ? `/${err.subcode}` : ''}]` : ''}`;
const tryGet = async (p, params) => {
  try { return (await graph('GET', p, params)).data || []; } catch (err) { return { error: errText(err) }; }
};

// A 1080×1080 solid PNG, so the test needs no image file or URL
function testPng() {
  const size = 1080;
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) row.set([0xda, 0x77, 0x56], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 1. Which Instagram accounts can Prelude see, and which have a Page?
console.log('Instagram accounts');
const pages = await tryGet('me/accounts', { fields: 'id,name,instagram_business_account{id,username}' });
const pageLinked = new Map();
if (!pages.error) {
  for (const p of pages) if (p.instagram_business_account) pageLinked.set(p.instagram_business_account.id, p.name);
}
const sources = {
  'business instagram_accounts': await tryGet(`${BUSINESS}/instagram_accounts`, { fields: 'id,username' }),
  'business owned_instagram_accounts': await tryGet(`${BUSINESS}/owned_instagram_accounts`, { fields: 'id,username' }),
  'ad account instagram_accounts': await tryGet(`${ACT}/instagram_accounts`, { fields: 'id,username' }),
};
const accounts = new Map();
for (const [label, list] of Object.entries(sources)) {
  if (list.error) {
    console.log(`  ${label}: FAIL ${list.error}`);
    continue;
  }
  console.log(`  ${label}: ${list.map(a => `@${a.username || '?'} (${a.id})`).join(', ') || 'none'}`);
  for (const a of list) {
    const entry = accounts.get(a.id) || { id: a.id, username: a.username, via: [] };
    entry.via.push(label);
    accounts.set(a.id, entry);
  }
}
for (const [id, pageName] of pageLinked) {
  if (accounts.has(id)) accounts.get(id).page = pageName;
}

const targets = [...accounts.values()].filter(a => !ONLY || a.id === ONLY || a.username?.toLowerCase() === ONLY);
if (!targets.length) {
  console.log(`\nNo Instagram account${ONLY ? ` matching "${ONLY}"` : ''} to test. Add it to Prelude's business first (see the top of this script).`);
  process.exit(1);
}

// 2. Paused campaigns + ad sets to hang the test ads on: traffic for the new ad,
// engagement for the boost (the same goals meta-launch.js uses)
const adSetFields = {
  status: 'PAUSED',
  billing_event: 'IMPRESSIONS',
  bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
  daily_budget: 500,
  targeting: {
    geo_locations: { countries: ['US'] },
    age_min: 18,
    age_max: 65,
    publisher_platforms: ['instagram'],
    targeting_automation: { advantage_audience: 0 },
  },
};
async function testCampaign(label, objective, goal) {
  const name = `Prelude Instagram-only test · ${label} (paused)`;
  const { id } = await graph('POST', `${ACT}/campaigns`, {
    name, objective, status: 'PAUSED', buying_type: 'AUCTION', special_ad_categories: [], is_adset_budget_sharing_enabled: false,
  });
  campaigns.push(id);
  const adSet = await graph('POST', `${ACT}/adsets`, { name, campaign_id: id, ...adSetFields, ...goal });
  console.log(`  ${label}: campaign ${id}, ad set ${adSet.id}`);
  return adSet.id;
}

console.log('\nTest campaigns (paused)');
const campaigns = [];
const results = [];
try {
  const adSet = await testCampaign('new ad', 'OUTCOME_TRAFFIC', { optimization_goal: 'LINK_CLICKS', destination_type: 'WEBSITE' });
  const engagementSet = await testCampaign('boost', 'OUTCOME_ENGAGEMENT', { optimization_goal: 'POST_ENGAGEMENT', destination_type: 'ON_POST' });
  const { images } = await graph('POST', `${ACT}/adimages`, { bytes: testPng().toString('base64') });
  const imageHash = Object.values(images)[0].hash;
  console.log(`  test image ${imageHash}`);

  // 3. Per account: a new image ad and a boost, both without page_id
  for (const a of targets) {
    const who = `@${a.username || a.id}${a.page ? ` (Page: ${a.page})` : ' (no Page found)'}`;
    console.log(`\n${who}, seen via ${a.via.join(', ')}`);
    const row = { account: who, newAd: null, boost: null };

    try {
      const creative = await graph('POST', `${ACT}/adcreatives`, {
        name: `Prelude Instagram-only test · @${a.username || a.id}`,
        object_story_spec: {
          instagram_user_id: a.id,
          link_data: {
            image_hash: imageHash,
            link: 'https://preludemusic.ai',
            message: 'Prelude test ad (paused, deleted)',
            call_to_action: { type: 'LEARN_MORE', value: { link: 'https://preludemusic.ai' } },
          },
        },
      });
      await graph('POST', `${ACT}/ads`, {
        name: `Prelude Instagram-only test · @${a.username || a.id}`,
        adset_id: adSet.id,
        creative: { creative_id: creative.id },
        status: 'PAUSED',
      });
      row.newAd = 'ok';
      console.log('  ok   new image ad without a Page');
    } catch (err) {
      row.newAd = errText(err);
      console.log(`  FAIL new image ad without a Page: ${row.newAd}`);
    }

    try {
      const media = (await graph('GET', `${a.id}/media`, { fields: 'id,permalink', limit: 1 })).data?.[0];
      if (!media) throw new Error('no posts found on the account');
      const creative = await graph('POST', `${ACT}/adcreatives`, {
        name: `Prelude Instagram-only boost test · @${a.username || a.id}`,
        instagram_user_id: a.id,
        source_instagram_media_id: media.id,
      });
      await graph('POST', `${ACT}/ads`, {
        name: `Prelude Instagram-only boost test · @${a.username || a.id}`,
        adset_id: engagementSet.id,
        creative: { creative_id: creative.id },
        status: 'PAUSED',
      });
      row.boost = 'ok';
      console.log(`  ok   boost of ${media.permalink || media.id} without a Page`);
    } catch (err) {
      row.boost = errText(err);
      console.log(`  FAIL boost without a Page: ${row.boost}`);
    }
    results.push(row);
  }
} catch (err) {
  console.log(`  FAIL setting up the test: ${errText(err)}`);
} finally {
  console.log('');
  for (const id of campaigns) {
    if (KEEP) {
      console.log(`Kept paused campaign ${id}. Delete it in Ads Manager when done.`);
      continue;
    }
    try {
      await graph('DELETE', id);
      console.log(`Deleted test campaign ${id}.`);
    } catch (err) {
      console.log(`Could not delete test campaign ${id} (${errText(err)}). It is paused; delete it in Ads Manager.`);
    }
  }
}

console.log('\nSummary');
for (const r of results) {
  console.log(`  ${r.account}\n    new ad: ${r.newAd}\n    boost:  ${r.boost}`);
}
