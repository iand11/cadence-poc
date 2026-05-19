export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url } = req.body || {};
  if (!url || !url.includes('docs.google.com')) {
    res.status(400).json({ error: 'Invalid Google Sheets URL' });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/csv,text/plain,*/*' },
      redirect: 'follow',
    });

    if (!response.ok) {
      res.status(response.status).json({
        error: response.status === 404
          ? 'Sheet not found. Make sure it is published to the web.'
          : `Google Sheets returned ${response.status}`,
      });
      return;
    }

    const text = await response.text();
    res.setHeader('Content-Type', 'text/csv');
    res.status(200).send(text);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
