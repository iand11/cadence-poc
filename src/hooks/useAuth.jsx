import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { flushUserData, cancelUserData } from '../data/userData';

const AuthContext = createContext(null);

// Persisted per-user state lives under these localStorage prefixes. When the
// signed-in user changes we clear them so the next account loads its own data
// from the server rather than inheriting the previous user's localStorage cache.
const PERSISTED_PREFIXES = ['musicspace-'];
// Which account the musicspace-* cache belongs to (outside the cleared
// prefix). Catches a switch that happened while no tab was open — e.g. user A
// closed the tab without signing out, then user B signs in.
const CACHE_OWNER_KEY = 'prelude-cache-owner';

function readOwner() {
  try { return localStorage.getItem(CACHE_OWNER_KEY); } catch { return null; }
}

function writeOwner(uid) {
  try {
    if (uid) localStorage.setItem(CACHE_OWNER_KEY, uid);
    else localStorage.removeItem(CACHE_OWNER_KEY);
  } catch { /* ignore */ }
}

function clearPersistedLocalState() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && PERSISTED_PREFIXES.some(p => k.startsWith(p))) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore quota/availability errors */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevUidRef = useRef(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const uid = u?.uid ?? null;
      // Wipe stale local state on any in-session change (switch account or
      // sign out), or when the cache is owned by a different account. A cache
      // with no recorded owner (pre-dates this key) is adopted as-is.
      const owner = readOwner();
      const switched = prevUidRef.current !== undefined && prevUidRef.current !== uid;
      if (switched || (uid && owner && owner !== uid)) {
        cancelUserData();
        clearPersistedLocalState();
      }
      writeOwner(uid);
      prevUidRef.current = uid;
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithEmail = useCallback((email, password) =>
    signInWithEmailAndPassword(auth, email, password), []);

  const signUpWithEmail = useCallback((email, password) =>
    createUserWithEmailAndPassword(auth, email, password), []);

  const signInWithGoogle = useCallback(() =>
    signInWithPopup(auth, googleProvider), []);

  // Flush queued user-data saves first — once signed out they'd have no token.
  const signOut = useCallback(async () => {
    await flushUserData();
    return firebaseSignOut(auth);
  }, []);

  // Firebase mutates currentUser in place; bump a counter so consumers
  // re-render with the new profile fields.
  const [, setProfileVersion] = useState(0);
  const updateProfile = useCallback(async (fields) => {
    if (!auth.currentUser) throw new Error('Not signed in');
    await firebaseUpdateProfile(auth.currentUser, fields);
    setProfileVersion((v) => v + 1);
  }, []);

  const sendPasswordReset = useCallback(() => {
    if (!auth.currentUser?.email) throw new Error('No email on this account');
    return firebaseSendPasswordResetEmail(auth, auth.currentUser.email);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, updateProfile, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
