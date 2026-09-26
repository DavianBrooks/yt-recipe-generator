# Technical Documentation

## 1. System overview

```
┌──────────────┐   POST {url}   ┌───────────────────────────────┐
│  React SPA   │ ─────────────► │ Netlify Function              │
│  (Vite/dist) │ ◄───────────── │ extract-recipe.mjs            │
└──────┬───────┘   recipe JSON  │  1. parse video ID            │
       │                        │  2. YouTube oEmbed (metadata) │
       │ Firebase SDK           │  3. youtube-transcript        │
       ▼                        │  4. OpenAI chat completion    │
┌──────────────┐                │     (JSON mode)               │
│  Firestore   │                └───────────────────────────────┘
│  recipes collection
└──────────────┘
```

Two trust boundaries matter:

- **`OPENAI_API_KEY` lives only in the function.** The browser never sees it.
- **`VITE_FIREBASE_*` values ship to the client by design.** The Firebase web config (`apiKey`, `projectId`, `appId`) is a public client credential — data protection comes from Firestore Security Rules, not key secrecy. The README's test-mode rules allow open read/write for the demo; tighten them if real users sign up.

## 2. API contract

### `POST /.netlify/functions/extract-recipe`

Request body:

```json
{ "url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ" }
```

Accepted URL forms: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts|embed|live/`, with or without scheme, `www.`/`m.` prefixes. Bare host+path strings are normalized to HTTPS before parsing.

Success `200`:

```json
{
  "title": "10-Minute Garlic Butter Pasta",
  "description": "A fast weeknight pasta ...",
  "servings": "2",
  "prepTime": "5 min",
  "cookTime": "10 min",
  "cuisine": "Italian",
  "difficulty": "Easy",
  "ingredients": [
    { "item": "spaghetti", "quantity": "200", "unit": "g", "notes": "" },
    { "item": "garlic", "quantity": "4", "unit": "cloves", "notes": "thinly sliced" }
  ],
  "steps": [
    { "order": 1, "instruction": "Boil salted water and cook pasta.", "duration": "9 min" }
  ],
  "tags": ["pasta", "quick", "weeknight"],
  "videoId": "aqz-KE-bpKQ",
  "videoUrl": "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  "channelTitle": "Channel Name",
  "thumbnail": "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg"
}
```

Errors — always `{ "error": "<human-readable message>" }`:

| Status | Cause |
|---|---|
| 400 | Missing/invalid `url`, or no YouTube video ID parsed |
| 404 | Video unavailable or private |
| 405 | Non-POST request |
| 422 | No captions available (or YouTube is rate-limiting the server IP), empty transcript, or video is not a recipe |
| 500 | `OPENAI_API_KEY` unset, malformed JSON body |
| 502 | OpenAI or transcript-fetch upstream failure (message passes through) |

### External calls made by the function

| Call | Purpose | Key needed |
|---|---|---|
| `GET youtube.com/oembed?url=…&format=json` | channel title + thumbnail | none |
| `YoutubeTranscript.fetchTranscript(videoId)` | full caption text | none |
| `POST $OPENAI_BASE_URL/chat/completions` (default api.openai.com) | transcript → structured JSON | `OPENAI_API_KEY` |

OpenAI settings: model `OPENAI_MODEL` env or `gpt-4o-mini`, `response_format: {type: "json_object"}`, `temperature: 0.2`, transcript capped at 24,000 chars (~90–120 min of speech) to bound cost/latency. The system prompt forbids inventing quantities — unknown fields come back as `""`.

## 3. Database schema — Firebase Firestore

Collection: **`recipes`** — created automatically on first save (Firestore is schemaless; this is the field contract the app writes):

| Field | Type | Source |
|---|---|---|
| `title` | String | LLM |
| `description` | String | LLM |
| `servings`, `prepTime`, `cookTime`, `cuisine`, `difficulty` | String | LLM (`""` when unknown) |
| `ingredients` | Array\<Object\> `{item, quantity, unit, notes}` | LLM |
| `steps` | Array\<Object\> `{order, instruction, duration}` | LLM |
| `tags` | Array\<String\> | LLM |
| `videoId`, `videoUrl`, `channelTitle`, `thumbnail` | String | function (oEmbed) |
| `createdAt` | Timestamp (`serverTimestamp()`) | Firestore |

The document ID (`doc.id`) is used as the recipe's `id` in the UI.

Queries used: `query(collection(db,'recipes'), orderBy('createdAt','desc'), limit(100))`, `addDoc`, `deleteDoc`.

**Suggested rules**: the README's test-mode setup allows open read/write for 30 days — fine for a demo. For anything longer, scope reads/writes behind Firebase Auth (`allow read, write: if request.auth != null`).

## 4. Front-end component breakdown

```
App.jsx                      state machine: tab | recipe | selected | loading/saving/error
├── LinkForm.jsx             controlled input; regex-validates YouTube host before submit
├── RecipeView.jsx           pure renderer; props: recipe, onSave, saving, saved, savedView
│                            (savedView hides the save button for cookbook entries)
└── SavedRecipes.jsx         grid; props: recipes, onSelect, onDelete, dbReady
```

`src/lib/firebase.js` — single Firebase app + Firestore init; exports `firebaseConfigured` flag so the UI degrades gracefully (generate still works, cookbook explains the missing config) instead of crashing.

`src/api.js` — the only import site for Firestore operations + the function call. Components never touch `fetch` or `firebase/firestore` directly.

### Data flow

1. `LinkForm` → `App.handleGenerate(url)` → `api.extractRecipe` → `POST` function.
2. Response stored in `recipe` state → `RecipeView` renders.
3. `handleSave` → `api.saveRecipe(recipe)` → `addDoc` into `recipes` → `saved` flag disables the button.
4. "My cookbook" tab → `listSavedRecipes` → grid; `onSelect` → `RecipeView` in `savedView` mode; `onDelete` → `deleteDoc` + local list filter.

## 5. Configuration reference

| Variable | Where used | Scope |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | `src/lib/firebase.js` | client (build-time) |
| `VITE_FIREBASE_PROJECT_ID` | `src/lib/firebase.js` | client (build-time) |
| `VITE_FIREBASE_APP_ID` | `src/lib/firebase.js` | client (build-time) |
| `VITE_FIREBASE_AUTH_DOMAIN` | `src/lib/firebase.js` | client; optional, defaults to `<project-id>.firebaseapp.com` |
| `OPENAI_API_KEY` | `extract-recipe.mjs` | server only |
| `OPENAI_MODEL` | `extract-recipe.mjs` | server only; optional, default `gpt-4o-mini` |
| `OPENAI_BASE_URL` | `extract-recipe.mjs` | server only; optional, default `https://api.openai.com/v1` — set to any OpenAI-compatible endpoint (e.g. `https://api.groq.com/openai/v1`) |

`netlify.toml`: `command = "npm run build"`, `publish = "dist"`, `functions = "netlify/functions"`, plus a non-forced `/* → /index.html` SPA fallback (function routes resolve before redirects, so `/.netlify/functions/*` is unaffected).

## 6. Known limits & future work

- Requires captions: auto-generated ones are fine; caption-free videos return 422 by design. A Whisper-based audio pipeline is the natural upgrade.
- YouTube rate-limits/blocks some datacenter IPs on the captions endpoint, so extraction can occasionally fail on otherwise-captioned videos — retrying or running the function elsewhere (e.g. locally) often succeeds.
- One recipe per video; multi-dish videos return the dominant recipe.
- No user accounts — all saved recipes are shared at app level.
- Rate limiting/caching (e.g., memoize extractions by `videoId`) is not implemented.
