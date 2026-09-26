# YouTube Recipe Generator

Turn any YouTube cooking video into a clean, structured recipe you can save to a personal cookbook.

Paste a YouTube link → the app pulls the video's captions and metadata → an LLM extracts the ingredients, steps, and metadata into structured JSON → review it, save it, and browse your cookbook later.

Built with **React + Vite**, **Netlify serverless functions** (the AI pipeline), and **Firebase Cloud Firestore** for storage.

## Features

- Submit any valid YouTube URL (watch, share/`youtu.be`, Shorts, embed links)
- AI extraction of: title, description, servings, prep/cook time, cuisine, difficulty, ingredients (item + quantity + unit + notes), ordered steps with durations, tags
- Video metadata pulled automatically (channel name, thumbnail, canonical URL)
- Save recipes to Firestore with one click
- Browse, reopen, and delete saved recipes in "My cookbook"
- Friendly errors for non-YouTube URLs, videos without captions, and non-recipe videos

## Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| Front-end | **React 19 + Vite** | Largest ecosystem and community for a beginner project; Vite gives instant dev server + one-command build; pairs natively with Netlify. |
| AI processing | **YouTube captions + OpenAI (`gpt-4o-mini`)** | Captions (`youtube-transcript`) are free and fast; the LLM turns unstructured narration into strict JSON via `response_format: json_object`. |
| API | **Netlify Function** (`netlify/functions/extract-recipe.mjs`) | Keeps `OPENAI_API_KEY` server-side; zero server management; deploys with the site. |
| Database | **Firebase Cloud Firestore** | Managed NoSQL with a JS SDK and a free tier; no schema migrations — the `recipes` collection is created on first save. |
| Hosting | **Netlify** | Free static hosting + serverless functions + env-var management in one place. |

## Architecture

```
Browser (React)
   │  POST /.netlify/functions/extract-recipe  {url}
   ▼
Netlify Function ──► YouTube (oEmbed + captions)
   │                 OpenAI (structured JSON)
   ▼
Structured recipe JSON ──► rendered in RecipeView
   │  "Save to my cookbook"
   ▼
Firebase Firestore  (recipes collection)
```

The browser never talks to OpenAI or YouTube directly — all external calls happen inside the function, so the only credentials on the client are the Firebase web config values (which are designed to be public; protect data with Firestore Security Rules instead).

## Prerequisites

- Node.js ≥ 20.19 (or ≥ 22.12) and npm
- A free [Firebase](https://console.firebase.google.com) project (Spark plan)
- An [OpenAI API key](https://platform.openai.com/api-keys)
- (Deploy only) a [Netlify](https://netlify.com) account

## Setup

### 1. Clone and install

```bash
git clone https://github.com/DavianBrooks/yt-recipe-generator.git
cd yt-recipe-generator
npm install
```

### 2. Create the Firebase project

1. Sign in at https://console.firebase.google.com → **Add project** → name it (e.g. `yt-recipes`) → continue (Analytics optional) → **Create project**.
2. On the project page, click the **web icon `</>`** to register a web app → name it → **Register app**. The `firebaseConfig` shown contains the values you need: `apiKey`, `projectId`, `appId`.
3. Left sidebar → **Build → Firestore Database** → **Create database** → pick a location → **Start in test mode** (allows public read/write for 30 days — fine for a demo; tighten rules later).

No collections are needed up front — the `recipes` collection is created automatically on the first save.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```bash
VITE_FIREBASE_API_KEY=<Firebase apiKey>
VITE_FIREBASE_PROJECT_ID=<Firebase projectId>
VITE_FIREBASE_APP_ID=<Firebase appId>
OPENAI_API_KEY=<your OpenAI key>
```

### 4. Run locally

The function and front-end run together via the Netlify CLI:

```bash
npx netlify dev
```

Open http://localhost:8888 — `netlify dev` serves the Vite app **and** the function, and reads `.env` automatically.

> Front-end only (no AI calls): `npm run dev` on port 5173 — extraction requests will 404 without `netlify dev`.

## Deploy to Netlify

**Option A — Git-connected (recommended):** push this repo to GitHub, then in Netlify → *Add new site → Import an existing project* → pick the repo. Netlify reads `netlify.toml` (build: `npm run build`, publish: `dist`, functions: `netlify/functions`). Set the same env vars under *Site settings → Environment variables*.

**Option B — CLI:**

```bash
npm install -g netlify-cli
netlify login
netlify init          # link the repo directory to a new site
netlify env:set OPENAI_API_KEY "..."
netlify env:set VITE_FIREBASE_API_KEY "..."
netlify env:set VITE_FIREBASE_PROJECT_ID "..."
netlify env:set VITE_FIREBASE_APP_ID "..."
netlify deploy --prod
```

## Usage

1. Paste any YouTube cooking-video URL and click **Generate recipe**.
2. Review the extracted ingredients and steps.
3. Click **Save to my cookbook**.
4. Open the **My cookbook** tab to browse, reopen, or delete saved recipes.

## Project structure

```
├── netlify/
│   └── functions/extract-recipe.mjs   # YouTube → transcript → OpenAI → JSON
├── src/
│   ├── api.js                         # function call + Firestore CRUD
│   ├── lib/firebase.js                # Firebase app + Firestore init
│   ├── components/
│   │   ├── LinkForm.jsx               # URL input + validation
│   │   ├── RecipeView.jsx             # structured recipe display
│   │   └── SavedRecipes.jsx           # cookbook grid
│   ├── App.jsx                        # tabs, state, orchestration
│   ├── main.jsx
│   └── index.css
├── docs/
│   ├── DAY_PLAN.md                    # 3-day build guide
│   ├── TECHNICAL.md                   # API, schema, components
│   └── DEMO_NOTES.md                  # presentation prep
├── netlify.toml
├── .env.example
└── package.json
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| "No captions available" | Pick a video with subtitles/CC enabled — extraction depends on the transcript. |
| "OPENAI_API_KEY is not configured" | Set it in `.env` (local) or Netlify env vars (deployed), then restart `netlify dev`. |
| "Firebase is not configured" | Set the `VITE_FIREBASE_*` vars and rebuild — `VITE_` vars are baked in at build time. |
| Function 404s locally | Use `npx netlify dev`, not `npm run dev`. |

## Docs

- [docs/DAY_PLAN.md](docs/DAY_PLAN.md) — three-day build guide with daily milestones
- [docs/TECHNICAL.md](docs/TECHNICAL.md) — API contract, database schema, component breakdown
- [docs/DEMO_NOTES.md](docs/DEMO_NOTES.md) — demo script and presentation tips
