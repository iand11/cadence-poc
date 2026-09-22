import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

const AuthContext = createContext(null);

// Persisted per-user state lives under these localStorage prefixes. When the
// signed-in user changes we clear them so the next account loads its own data
// from the server rather than inheriting the previous user's localStorage cache.
const PERSISTED_PREFIXES = ['musicspace-'];

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
      // On the first callback, adopt the current uid without clearing.
      // On any later change (switch account or sign out), wipe stale local state.
      if (prevUidRef.current !== undefined && prevUidRef.current !== uid) {
        clearPersistedLocalState();
      }
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

  const signOut = useCallback(() =>
    firebaseSignOut(auth), []);

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut }}>
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
