import { useEffect, useState } from 'react';
import { checkAdmin } from '../data/adminHealth';

/** True when the signed-in user is a Prelude admin (PRELUDE_ADMIN_UIDS). */
export function useIsAdmin(user) {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    checkAdmin().then((a) => { if (!cancelled) setAdmin(a); });
    return () => { cancelled = true; };
  }, [user]);
  return !!user && admin;
}
