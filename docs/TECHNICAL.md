# Technical Documentation

## 1. System overview

```
┌──────────────┐   POST {url}   ┌───────────────────────────────┐
│  React SPA   │ ─────────────► │ Netlify Function              │
│  (Vite/dist) │ ◄───────────── │ extract-recipe.mjs            │
└──────┬───────┘   recipe JSON  │  1. parse video ID            │
       │                        │  2. YouTube oEmbed (metadata) │
       │ Parse JS SDK           │  3. youtube-transcript        │
       ▼                        │  4. OpenAI chat completion    │
┌──────────────┐                │     (JSON mode)               │
│  Back4App    │                └───────────────────────────────┘
│  Parse: Recipe class
└──────────────┘
```

Two trust boundaries matter:

- **`OPENAI_API_KEY` lives only in the function.** The browser never sees it.
- **`VITE_PARSE_*` keys ship to the client by design.** Back4App's JavaScript key is a public client credential — data protection comes from Parse Class-Level Permissions, not key secrecy. For a stricter model, set CLPs on the `Recipe` class in the Back4App dashboard.

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
| `POST api.openai.com/v1/chat/completions` | transcript → structured JSON | `OPENAI_API_KEY` |

OpenAI settings: model `OPENAI_MODEL` env or `gpt-4o-mini`, `response_format: {type: "json_object"}`, `temperature: 0.2`, transcript capped at 24,000 chars (~90–120 min of speech) to bound cost/latency. The system prompt forbids inventing quantities — unknown fields come back as `""`.

## 3. Database schema — Back4App Parse

Class: **`Recipe`** — created automatically on first save (Parse is schemaless; this is the field contract the app writes):

| Field | Type | Source |
|---|---|---|
| `title` | String | LLM |
| `description` | String | LLM |
| `servings`, `prepTime`, `cookTime`, `cuisine`, `difficulty` | String | LLM (`""` when unknown) |
| `ingredients` | Array\<Object\> `{item, quantity, unit, notes}` | LLM |
| `steps` | Array\<Object\> `{order, instruction, duration}` | LLM |
| `tags` | Array\<String\> | LLM |
| `videoId`, `videoUrl`, `channelTitle`, `thumbnail` | String | function (oEmbed) |
| `objectId`, `createdAt`, `updatedAt` | Parse built-ins | Back4App |

Queries used: `new Parse.Query('Recipe').descending('createdAt').limit(100).find()`.

**Suggested CLP** (Back4App → `Recipe` class → Security): Public Read enabled for a read-only demo, or lock everything behind authenticated users if login is added later. For this demo all recipes are app-level shared data.

## 4. Front-end component breakdown

```
App.jsx                      state machine: tab | recipe | selected | loading/saving/error
├── LinkForm.jsx             controlled input; regex-validates YouTube host before submit
├── RecipeView.jsx           pure renderer; props: recipe, onSave, saving, saved, savedView
│                            (savedView hides the save button for cookbook entries)
└── SavedRecipes.jsx         grid; props: recipes, onSelect, onDelete, parseReady
```

`src/lib/parse.js` — single Parse SDK init; exports `parseConfigured` flag so the UI degrades gracefully (generate still works, cookbook explains the missing config) instead of crashing.

`src/api.js` — the only import site for Parse operations + the function call. Components never touch `fetch` or `Parse` directly.

### Data flow

1. `LinkForm` → `App.handleGenerate(url)` → `api.extractRecipe` → `POST` function.
2. Response stored in `recipe` state → `RecipeView` renders.
3. `handleSave` → `api.saveRecipe(recipe)` → `Recipe` object created → `saved` flag disables the button.
4. "My cookbook" tab → `listSavedRecipes` → grid; `onSelect` → `RecipeView` in `savedView` mode; `onDelete` → `obj.destroy()` + local list filter.

## 5. Configuration reference

| Variable | Where used | Scope |
|---|---|---|
| `VITE_PARSE_APP_ID` | `src/lib/parse.js` | client (build-time) |
| `VITE_PARSE_JS_KEY` | `src/lib/parse.js` | client (build-time) |
| `VITE_PARSE_SERVER_URL` | `src/lib/parse.js` | client; defaults to `https://parseapi.back4app.com` |
| `OPENAI_API_KEY` | `extract-recipe.mjs` | server only |
| `OPENAI_MODEL` | `extract-recipe.mjs` | server only; optional, default `gpt-4o-mini` |

`netlify.toml`: `command = "npm run build"`, `publish = "dist"`, `functions = "netlify/functions"`, plus a non-forced `/* → /index.html` SPA fallback (function routes resolve before redirects, so `/.netlify/functions/*` is unaffected).

## 6. Known limits & future work

- Requires captions: auto-generated ones are fine; caption-free videos return 422 by design. A Whisper-based audio pipeline is the natural upgrade.
- YouTube rate-limits/blocks some datacenter IPs on the captions endpoint, so extraction can occasionally fail on otherwise-captioned videos — retrying or running the function elsewhere (e.g. locally) often succeeds.
- One recipe per video; multi-dish videos return the dominant recipe.
- No user accounts — all saved recipes are shared at app level.
- Rate limiting/caching (e.g., memoize extractions by `videoId`) is not implemented.
