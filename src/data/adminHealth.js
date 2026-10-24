// Admin data health (/api/admin/health, api/lib/data-health.js). Firebase-authed.
import { request } from './metaAds';

export const fetchDataHealth = ({ fresh = false } = {}) =>
  request(`/api/admin/health${fresh ? '?fresh=1' : ''}`);

// Asked once per page load; the answer only shows or hides the nav link (the API enforces it)
let adminCheck;
export function checkAdmin() {
  adminCheck ||= request('/api/admin/health?check=1').then((r) => !!r.admin).catch(() => { adminCheck = null; return false; });
  return adminCheck;
}
