import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID &&
    import.meta.env.VITE_FIREBASE_APP_ID,
);

let db = null;
let auth = null;
let readyPromise = null;

if (firebaseConfigured) {
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
      `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  db = getFirestore(app);
  auth = getAuth(app);
  // Anonymous sign-in gives every visitor a stable uid without a login wall.
  // Resolves null if Anonymous auth isn't enabled or sign-in fails — callers
  // must handle the unauthenticated case instead of hanging.
  readyPromise = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8000);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        clearTimeout(timer);
        unsub();
        resolve(user);
      }
    });
    signInAnonymously(auth).catch(() => {
      clearTimeout(timer);
      unsub();
      resolve(null);
    });
  });
}

/** Resolves with the signed-in user (anonymous) or null if unconfigured. */
export function authReady() {
  return readyPromise || Promise.resolve(null);
}

export function currentUid() {
  return auth?.currentUser?.uid ?? null;
}

export { db, auth };
