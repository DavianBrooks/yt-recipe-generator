import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db, firebaseConfigured } from './lib/firebase';

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

const NOT_CONFIGURED =
  'Firebase is not configured. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID in your environment.';

export async function saveRecipe(recipe) {
  if (!firebaseConfigured) throw new Error(NOT_CONFIGURED);
  const clean = Object.fromEntries(
    Object.entries(recipe).filter(([, v]) => v !== undefined && v !== null),
  );
  const ref = await addDoc(collection(db, 'recipes'), {
    ...clean,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, ...clean };
}

export async function listSavedRecipes() {
  if (!firebaseConfigured) return [];
  const q = query(collection(db, 'recipes'), orderBy('createdAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteRecipe(id) {
  await deleteDoc(doc(db, 'recipes', id));
}
