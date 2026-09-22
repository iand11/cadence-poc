import admin from 'firebase-admin';

let app = null;

function getApp() {
  if (app) return app;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    const credential = admin.credential.cert(JSON.parse(json));
    app = admin.initializeApp({ credential });
    return app;
  } catch (err) {
    console.warn('Firebase Admin init failed:', err.message);
    return null;
  }
}

export async function verifyAuth(req) {
  const firebaseApp = getApp();
  if (!firebaseApp) return null; // No service account configured — skip verification

  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    // In dev / offline, allow unauthenticated requests through
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      return null;
    }
    const err = new Error('Missing authorization token');
    err.status = 401;
    throw err;
  }

  try {
    return await firebaseApp.auth().verifyIdToken(token);
  } catch (e) {
    // Network errors (offline/unreachable) — pass through rather than blocking
    if (e.code === 'ENOTFOUND' || e.code === 'EHOSTUNREACH' || e.code === 'ENETUNREACH' ||
        e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED' || e.message?.includes('fetch')) {
      console.warn('Firebase token verification skipped (network error):', e.code || e.message);
      return null;
    }
    const err = new Error('Invalid or expired token');
    err.status = 401;
    throw err;
  }
}

export function withAuth(handler) {
  return async (req, res) => {
    try {
      await verifyAuth(req);
    } catch (e) {
      return res.status(e.status || 401).json({ error: e.message || 'Unauthorized' });
    }
    return handler(req, res);
  };
}
