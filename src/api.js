import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { authReady, currentUid, db, firebaseConfigured } from './lib/firebase';
import { extractVideoId } from './lib/videoId';

const NOT_CONFIGURED =
  'Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID in your environment.';

export async function extractRecipe(videoUrl) {
  const res = await fetch('/.netlify/functions/extract-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: videoUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Recipe extraction failed (HTTP ${res.status})`);
  }
  return data;
}

/** Returns a previously generated recipe for this videoId, or null. */
export async function findCachedRecipe(videoUrl) {
  if (!firebaseConfigured) return null;
  const videoId = extractVideoId(videoUrl.trim());
  if (!videoId) return null;
  await authReady();
  const uid = currentUid();
  if (!uid) return null;
  const q = query(
    collection(db, 'recipes'),
    where('uid', '==', uid),
    where('videoId', '==', videoId),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function saveRecipe(recipe) {
  if (!firebaseConfigured) throw new Error(NOT_CONFIGURED);
  await authReady();
  const uid = currentUid();
  if (!uid) throw new Error('Sign-in failed — check that Anonymous auth is enabled in Firebase.');
  const clean = Object.fromEntries(
    Object.entries(recipe).filter(([, v]) => v !== undefined && v !== null),
  );
  delete clean.id;
  delete clean.createdAt;
  const ref = await addDoc(collection(db, 'recipes'), {
    ...clean,
    uid,
    shared: false,
    createdAt: Date.now(),
  });
  return { id: ref.id, ...clean };
}

export async function listSavedRecipes() {
  if (!firebaseConfigured) return [];
  await authReady();
  const uid = currentUid();
  if (!uid) return [];
  // uid filter + client-side sort avoids needing a composite index
  const q = query(collection(db, 'recipes'), where('uid', '==', uid), limit(200));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function deleteRecipe(id) {
  await deleteDoc(doc(db, 'recipes', id));
}

/** Make a recipe publicly readable and return its share URL. */
export async function shareRecipe(id) {
  await updateDoc(doc(db, 'recipes', id), { shared: true });
  return `${window.location.origin}${window.location.pathname}?r=${id}`;
}

/** Fetch a shared recipe — works without sign-in (rules allow shared reads). */
export async function getSharedRecipe(id) {
  if (!firebaseConfigured) return null;
  const snap = await getDoc(doc(db, 'recipes', id));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!data.shared) return null;
  return { id: snap.id, ...data };
}

export { firebaseConfigured, extractVideoId };
