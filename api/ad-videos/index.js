// /api/ad-videos — videos uploaded for new Meta ads, sent in chunks.
//
//   POST { action: 'start', name, contentType, size }  → { id }      (signed in; MP4/MOV/WebM, max 100 MB)
//   POST { action: 'chunk', id, offset, data }          → { received } (data = base64, max 3 MB)
//   POST { action: 'finish', id }                       → { id, url }
//   GET  ?id=<uuid>                                     → the video
import { getUid, readBody, sendError } from '../lib/meta.js';
import { startAdVideo, appendAdVideo, finishAdVideo, getAdVideo } from '../lib/ad-videos.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      const video = await getAdVideo(id);
      if (!video) return res.status(404).json({ error: 'Video not found' });
      res.setHeader('Content-Type', video.content_type);
      res.setHeader('Content-Length', video.bytes.length);
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      res.statusCode = 200;
      return res.end(video.bytes);
    }
    if (req.method === 'POST') {
      const uid = await getUid(req);
      const body = await readBody(req);
      if (body.action === 'start') return res.status(200).json(await startAdVideo(uid, body));
      if (body.action === 'chunk') return res.status(200).json(await appendAdVideo(uid, body));
      if (body.action === 'finish') return res.status(200).json(await finishAdVideo(uid, body));
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.statusCode = 405;
    return res.end();
  } catch (err) {
    return sendError(res, err);
  }
}
