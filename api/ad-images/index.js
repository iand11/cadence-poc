// /api/ad-images — images uploaded for new ads.
//
//   POST { dataUrl, width?, height? } → { id, url }   (signed in; JPG/PNG/WebP, max 3 MB)
//   GET  ?id=<uuid>                   → the image
import { getUid, readBody, sendError } from '../lib/meta.js';
import { saveAdImage, getAdImage } from '../lib/ad-images.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      const image = await getAdImage(id);
      if (!image) return res.status(404).json({ error: 'Image not found' });
      res.setHeader('Content-Type', image.content_type);
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      res.statusCode = 200;
      return res.end(image.bytes);
    }
    if (req.method === 'POST') {
      const uid = await getUid(req);
      const body = await readBody(req);
      return res.status(200).json(await saveAdImage(uid, body.dataUrl, body));
    }
    res.statusCode = 405;
    return res.end();
  } catch (err) {
    return sendError(res, err);
  }
}
