// /api/streams — daily stream counts per streaming service for stream-goal campaigns
// (api/lib/stream-counts.js says which services have a public count and how each is read).
//
//   GET ?id=<tracker id>   → { id, title, startDate, endDate, sources: [{ service, baseline, latest, gain, daily }], youtube, services }
//   GET ?probe=<Spotify track/album URL> → what the public page contains (checks the play-count reader)
//   GET ?preview=<link slug> → { tracked: [{ service, url }], skipped: [{ service, reason }] } for a smart link
//   POST { action: 'create', id, linkSlug?, links?, title?, artistSlug?, artistName?, startDate, endDate }
//        → starts tracking (takes the first count now); returns the report plus skipped services
//   POST { action: 'add', id, url }                        → track one more link (another video, say)
//   POST { action: 'count', id, service, externalId, day?, count } → a count entered by hand
//   POST { action: 'refresh', id }                         → read the automatic counts now
//   DELETE ?id=<tracker id>&service=&externalId=           → stop tracking one source
import { query, queryOne } from '../lib/db.js';
import { getUid, readBody, sendError } from '../lib/meta.js';
import {
  ensureStreamTables, createTracker, ownedTracker, trackerReport, recordCount,
  snapshotTracker, addSources, sourceFromLink,
} from '../lib/stream-counts.js';
import { parseSourceUrl } from '../lib/link-lookup.js';
import { probeSpotifyPage } from '../lib/spotify-playcount.js';

const bad = (message, status = 400) => Object.assign(new Error(message), { status });

export default async function handler(req, res) {
  const params = new URL(req.url, 'http://localhost').searchParams;
  try {
    await ensureStreamTables();
    const uid = await getUid(req);

    if (req.method === 'GET') {
      if (params.get('probe')) {
        const src = parseSourceUrl(params.get('probe'));
        if (src?.service !== 'spotify' || src.kind === 'artist') throw bad('Pass a Spotify track or album link.');
        return res.status(200).json(await probeSpotifyPage(src));
      }
      if (params.get('preview')) {
        const link = await queryOne('SELECT links FROM smart_links WHERE slug = $1 AND user_id = $2', [params.get('preview'), uid]);
        if (!link) throw bad('Smart link not found', 404);
        const tracked = [];
        const skipped = [];
        for (const l of link.links || []) {
          const s = sourceFromLink(l);
          if (s.skipped) skipped.push({ service: s.service, reason: s.skipped });
          else if (!tracked.some(t => t.service === s.service && t.externalId === s.externalId)) tracked.push(s);
        }
        return res.status(200).json({ tracked, skipped });
      }
      const tracker = await ownedTracker(uid, params.get('id'));
      return res.status(200).json(await trackerReport(tracker));
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.action === 'create') {
        const { skipped, notes } = await createTracker(uid, body);
        const tracker = await ownedTracker(uid, body.id);
        return res.status(200).json({ ...(await trackerReport(tracker)), skipped, notes });
      }
      const tracker = await ownedTracker(uid, body.id);
      if (body.action === 'add') {
        const skipped = await addSources(tracker.id, [{ service: null, url: String(body.url || '').trim() }]);
        if (skipped.length) throw bad(skipped[0].reason);
        await snapshotTracker(tracker.id);
      } else if (body.action === 'count') {
        await recordCount(tracker.id, body);
      } else if (body.action === 'refresh') {
        await snapshotTracker(tracker.id);
      } else {
        throw bad('Unknown action');
      }
      return res.status(200).json(await trackerReport(tracker));
    }

    if (req.method === 'DELETE') {
      const tracker = await ownedTracker(uid, params.get('id'));
      await query('DELETE FROM stream_tracker_sources WHERE tracker_id = $1 AND service = $2 AND external_id = $3',
        [tracker.id, params.get('service'), params.get('externalId')]);
      return res.status(200).json(await trackerReport(tracker));
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
