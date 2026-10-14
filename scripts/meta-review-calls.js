#!/usr/bin/env node
// Make the Graph API test calls Meta's App Review asks for under "Create & manage ads
// with Marketing API": one successful call per permission, plus 500 Marketing API calls
// at an 85%+ success rate for the Marketing API access tier.
//
//   npm run meta:review-calls                  permission calls + 500 Marketing API calls
//   npm run meta:review-calls -- --count 0     permission calls only
//   npm run meta:review-calls -- --count 200 --delay 6
//
// Uses Prelude's system-user token (META_PRELUDE_TOKEN), Prelude's ad account
// (META_PRELUDE_AD_ACCOUNT_ID) and business (META_PRELUDE_BUSINESS_ID) from the
// environment or .env. The token must come from the app under review. The system user
// needs Prelude's Page assigned for the Page calls.
//
// The one write call creates a PAUSED campaign with no ad set or ads and deletes it right
// away, so nothing can spend. Marketing API calls are paced (development tier allows
// roughly one read every 5 seconds); a rate-limit error pauses for 5 minutes instead of
// counting more failures.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};
const COUNT = arg('count', 500);
const DELAY_MS = arg('delay', 5.5) * 1000;

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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function graph(method, p, params = {}) {
  const q = new URLSearchParams({ access_token: TOKEN, appsecret_proof: proof });
  for (const [k, v] of Object.entries(params)) q.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  const url = `${GRAPH}/${p}`;
  const res = method === 'GET' || method === 'DELETE'
    ? await fetch(`${url}?${q}`, { method })
    : await fetch(url, { method, body: q });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error || {};
    throw Object.assign(new Error(e.message || `HTTP ${res.status}`), { code: e.code, subcode: e.error_subcode });
  }
  return body;
}

async function step(label, fn) {
  try {
    const out = await fn();
    console.log(`  ok   ${label}${out ? ` (${out})` : ''}`);
    return true;
  } catch (err) {
    console.log(`  FAIL ${label}: ${err.message}${err.code ? ` [code ${err.code}]` : ''}`);
    return false;
  }
}

console.log('Permission calls');
let pageId = null;
await step('public_profile: me', async () => (await graph('GET', 'me', { fields: 'id,name' })).name);
await step('business_management: business', async () => (await graph('GET', BUSINESS, { fields: 'id,name' })).name);
await step('business_management: owned ad accounts', async () =>
  `${(await graph('GET', `${BUSINESS}/owned_ad_accounts`, { fields: 'id,name' })).data.length} ad account(s)`);
await step('Business Asset User Profile Access: business users', async () =>
  `${(await graph('GET', `${BUSINESS}/business_users`, { fields: 'id,name' })).data.length} user(s)`);
await step('pages_show_list: me/accounts', async () => {
  const pages = (await graph('GET', 'me/accounts', { fields: 'id,name' })).data;
  pageId = pages[0]?.id || null;
  if (!pageId) throw new Error('no Page assigned to the system user (Business Settings → System users → Assign assets → Pages)');
  return pages.map(p => p.name).join(', ');
});
if (pageId) {
  await step('pages_read_engagement: page', async () => {
    const page = await graph('GET', pageId, { fields: 'name,fan_count,followers_count' });
    return `${page.name}, ${page.followers_count ?? page.fan_count ?? 0} followers`;
  });
}
await step('ads_read: ad account', async () => (await graph('GET', ACT, { fields: 'name,account_status,currency' })).name);
await step('ads_read: campaigns', async () => `${(await graph('GET', `${ACT}/campaigns`, { fields: 'id,name' })).data.length} campaign(s)`);
await step('ads_management: create + delete a paused campaign', async () => {
  const { id } = await graph('POST', `${ACT}/campaigns`, {
    name: 'Prelude App Review test (deleted)',
    objective: 'OUTCOME_AWARENESS',
    status: 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
  });
  await graph('DELETE', id);
  return `campaign ${id} created and deleted`;
});

if (COUNT > 0) {
  console.log(`\nMarketing API calls: ${COUNT}, one every ${DELAY_MS / 1000}s (about ${Math.ceil((COUNT * DELAY_MS) / 60000)} min)`);
  const reads = [
    () => graph('GET', ACT, { fields: 'name,account_status,amount_spent,currency' }),
    () => graph('GET', `${ACT}/campaigns`, { fields: 'id,name,status', limit: 25 }),
    () => graph('GET', `${ACT}/insights`, { fields: 'spend,impressions,reach', date_preset: 'last_30d' }),
  ];
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < COUNT; i++) {
    try {
      await reads[i % reads.length]();
      ok++;
    } catch (err) {
      failed++;
      // 4, 17, 32, 613, 80000-80014: rate limits. Back off rather than pile up failures.
      if ([4, 17, 32, 613].includes(err.code) || (err.code >= 80000 && err.code <= 80014)) {
        console.log(`  rate limited at call ${i + 1} [code ${err.code}], waiting 5 minutes`);
        await sleep(5 * 60 * 1000);
      } else {
        console.log(`  call ${i + 1} failed: ${err.message}`);
      }
    }
    if ((i + 1) % 25 === 0 || i + 1 === COUNT) {
      console.log(`  ${i + 1}/${COUNT}: ${ok} ok, ${failed} failed (${((ok / (ok + failed)) * 100).toFixed(1)}% success)`);
    }
    await sleep(DELAY_MS);
  }
}

console.log('\nDone. App Dashboard → App Review → Testing can take up to 24 hours to show the calls.');
