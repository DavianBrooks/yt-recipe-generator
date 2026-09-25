import Parse, { parseConfigured } from './lib/parse';

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

export async function saveRecipe(recipe) {
  if (!parseConfigured) {
    throw new Error(
      'Back4App is not configured. Set VITE_PARSE_APP_ID and VITE_PARSE_JS_KEY in your environment.',
    );
  }
  const Recipe = Parse.Object.extend('Recipe');
  const obj = new Recipe();
  for (const [key, value] of Object.entries(recipe)) {
    if (value !== undefined && value !== null) obj.set(key, value);
  }
  return obj.save();
}

export async function listSavedRecipes() {
  if (!parseConfigured) return [];
  const Recipe = Parse.Object.extend('Recipe');
  const query = new Parse.Query(Recipe);
  query.descending('createdAt');
  query.limit(100);
  const results = await query.find();
  return results.map((r) => ({ objectId: r.id, ...r.toJSON() }));
}

export async function deleteRecipe(objectId) {
  const Recipe = Parse.Object.extend('Recipe');
  const obj = new Recipe();
  obj.id = objectId;
  return obj.destroy();
}
