import { initializeApp } from 'firebase/app';
import {
  EmailAuthProvider,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
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
  // Guests get an anonymous uid so cookbook reads/writes never hang;
  // resolves null if the provider is off so the UI can degrade gracefully.
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

/** Resolves with the signed-in user (anonymous or email) or null. */
export function authReady() {
  return readyPromise || Promise.resolve(null);
}

export function currentUid() {
  return auth?.currentUser?.uid ?? null;
}

export function currentUser() {
  return auth?.currentUser ?? null;
}

export function onUser(cb) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, cb);
}

/**
 * Sign up: links the email credential to the current anonymous account when
 * possible so the guest's saved recipes follow them onto the permanent uid.
 * Falls back to a plain sign-in if the email is already registered.
 */
export async function signUpEmail(email, password) {
  const cred = EmailAuthProvider.credential(email, password);
  if (auth.currentUser?.isAnonymous) {
    try {
      await linkWithCredential(auth.currentUser, cred);
      return auth.currentUser;
    } catch (e) {
      if (e.code !== 'auth/email-already-in-use' && e.code !== 'auth/credential-already-in-use') {
        throw e;
      }
      // email exists — treat as a sign-in instead
    }
  }
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

export async function signInEmail(email, password) {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

export async function signOutUser() {
  await signOut(auth);
  // Fall back to a fresh guest session so the app keeps working.
  await signInAnonymously(auth).catch(() => {});
}

export { db, auth };
