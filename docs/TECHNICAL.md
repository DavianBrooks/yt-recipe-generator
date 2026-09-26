# Technical Documentation

## 1. System overview

```
┌──────────────┐   POST {url}   ┌───────────────────────────────┐
│  React SPA   │ ─────────────► │ Netlify Function              │
│  (Vite/dist) │ ◄───────────── │ extract-recipe.mjs            │
└──────┬───────┘   recipe JSON  │  1. parse video ID            │
       │                        │  2. YouTube oEmbed (metadata) │
       │ Firebase SDK           │  3. youtube-transcript →      │
       ▼                        │     Whisper audio fallback    │
┌──────────────┐                │  4. LLM chat (JSON mode)      │
│  Firestore   │                └───────────────────────────────┘
│  recipes + anon Auth         │
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
| `youtubei.js` stream + `POST $OPENAI_BASE_URL/audio/transcriptions` | Whisper fallback when captions are missing (best-effort — YouTube may require a PoToken on datacenter IPs; `WHISPER_MODEL` env, default `whisper-large-v3-turbo`) | `OPENAI_API_KEY` |
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
| `uid` | String | Firebase anonymous auth — owner of the cookbook entry |
| `shared` | Bool | set by the Share button; enables public read via `?r=<id>` |
| `createdAt` | Number (`Date.now()`) | client |

The document ID (`doc.id`) is used as the recipe's `id` in the UI and as the share-link token.

Queries used: `where('uid','==',uid)` + client-side sort (avoids composite indexes), `where('videoId','==',id)` for the extraction cache, `addDoc`, `updateDoc` (share), `deleteDoc`, `getDoc` (shared read).

**Rules** (`firestore.rules`, publish in the console): owners read/write their own `uid` docs; `shared == true` docs are world-readable; creates must stamp the caller's uid.

## 4. Front-end component breakdown

```
App.jsx                      state machine + ?r= shared-view route + cache check
├── LinkForm.jsx             controlled input; regex-validates YouTube host before submit
├── RecipeView.jsx           renderer + Edit mode (draft state) + Share + Print buttons;
│                            props: recipe, onSave(recipe|draft), onShare, savedView
└── SavedRecipes.jsx         grid + search box + cuisine/tag filters; props: recipes,
                             onSelect, onDelete, dbReady
```

`src/lib/firebase.js` — single Firebase app + anonymous Auth + Firestore init; exports `authReady()` (resolves after `signInAnonymously` settles) and `currentUid()`. `firebaseConfigured` still lets the UI degrade gracefully.

`src/lib/videoId.js` — shared YouTube URL parser imported by both the SPA and the Netlify function.

`src/api.js` — the only import site for Firestore operations + the function call. Components never touch `fetch` or `firebase/firestore` directly.

### Data flow

1. `LinkForm` → `App.handleGenerate(url)` → `api.findCachedRecipe(url)` first — a `uid`+`videoId` Firestore hit skips the LLM entirely ("loaded it instantly" notice) → else `api.extractRecipe` → `POST` function.
2. Response stored in `recipe` state → `RecipeView` renders; **Edit** swaps renderers for inputs bound to a `draft` state, so `onSave(draft)` persists user corrections.
3. `handleSave` → `api.saveRecipe` → `addDoc` with `{uid, shared:false, createdAt:Date.now()}`.
4. "My cookbook" tab → `listSavedRecipes` (uid-scoped) → grid with search + cuisine/tag filters; `onSelect` → `RecipeView` in `savedView` mode; `onDelete` → `deleteDoc`.
5. **Share** on a saved recipe → `updateDoc {shared:true}` → copies `?r=<docId>`; a visitor hitting that URL loads `getSharedRecipe` (allowed by the rules without auth) into a standalone read view.
6. **Print / PDF** → `window.print()` + `@media print` CSS isolates `.recipe-card` and hides chrome.

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
| `WHISPER_MODEL` | `extract-recipe.mjs` | server only; optional, default `whisper-large-v3-turbo` (`whisper-1` on OpenAI) |

`netlify.toml`: `command = "npm run build"`, `publish = "dist"`, `functions = "netlify/functions"`, plus a non-forced `/* → /index.html` SPA fallback (function routes resolve before redirects, so `/.netlify/functions/*` is unaffected).

## 6. Known limits & future work

- Caption-less videos fall back to audio transcription (Whisper), but YouTube increasingly requires a proof-of-origin token on stream URLs fetched from datacenter IPs — the fallback is best-effort and degrades to a clear 422. A residential proxy or PoToken service would make it reliable.
- YouTube rate-limits/blocks some datacenter IPs on the captions endpoint, so extraction can occasionally fail on otherwise-captioned videos — retrying or running the function elsewhere (e.g. locally) often succeeds.
- One recipe per video; multi-dish videos return the dominant recipe.
- Cookbooks are per-browser via anonymous Auth — no email/password sign-in yet, so a cookbook doesn't follow a user across devices (Firebase Auth upgrade path is one provider toggle).
- The `videoId` cache is per-user; a global extraction cache would need a separate `videoCache` collection readable by all.
