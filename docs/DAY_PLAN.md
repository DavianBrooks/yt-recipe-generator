# 3-Day Development Guide

A beginner-friendly, day-by-day plan for building this project. Day 1 = **Thursday, Sept 25, 2026**. Each day ends with a milestone you can demo.

## Day 1 — Scaffold & Front-End (Sept 25)

**Goal:** a running React app with the full UI, using mock data.

| Task | Details | Est. |
|---|---|---|
| 1.1 | Install Node ≥20.19, create GitHub repo, clone, run `npm create vite@latest` (React template) | 30 min |
| 1.2 | Clean the template: delete boilerplate assets, set the page title, add `.gitignore` | 15 min |
| 1.3 | Build `LinkForm.jsx` — URL input, client-side YouTube validation, submit handler | 45 min |
| 1.4 | Build `RecipeView.jsx` — header (thumbnail/title/channel), meta chips, ingredients list, steps list | 60 min |
| 1.5 | Build `SavedRecipes.jsx` — grid of saved cards + delete button | 45 min |
| 1.6 | Wire it together in `App.jsx` with tabs ("Generate" / "My cookbook") and a hard-coded sample recipe | 45 min |
| 1.7 | Write `index.css` — layout, cards, responsive rules | 60 min |
| 1.8 | Commit on `feature/frontend-ui`, open PR, merge | 15 min |

**Milestone 1:** app renders a realistic recipe from mock data; all three components work.

## Day 2 — AI Pipeline & Database (Sept 26)

**Goal:** real end-to-end extraction and persistence.

| Task | Details | Est. |
|---|---|---|
| 2.1 | Create Back4App app; copy Application ID + JavaScript Key into `.env` | 30 min |
| 2.2 | Write `src/lib/parse.js` (SDK init) and `src/api.js` (`extractRecipe`, `saveRecipe`, `listSavedRecipes`, `deleteRecipe`) | 45 min |
| 2.3 | Write `netlify/functions/extract-recipe.mjs`: URL → video ID → oEmbed metadata → captions via `youtube-transcript` | 90 min |
| 2.4 | Add the OpenAI call: system prompt + `response_format: json_object` → validated recipe JSON | 60 min |
| 2.5 | `npm i parse youtube-transcript`; run `npx netlify dev`; test with 3–4 real cooking videos | 60 min |
| 2.6 | Wire Save → Back4App; verify rows appear in the Back4App dashboard's `Recipe` class | 30 min |
| 2.7 | Error handling pass: bad URL, no captions, non-recipe video, missing keys | 45 min |
| 2.8 | Commit on `feature/ai-extraction`, open PR, merge | 15 min |

**Milestone 2:** paste a real YouTube link → structured recipe → save → see it in "My cookbook" and in the Back4App dashboard.

## Day 3 — Deploy, Docs & Demo Prep (Sept 27)

**Goal:** public URL + complete documentation + rehearsed demo.

| Task | Details | Est. |
|---|---|---|
| 3.1 | Write `netlify.toml` (build cmd, publish dir, functions dir, SPA fallback) | 20 min |
| 3.2 | Deploy: Netlify → import GitHub repo (or `netlify deploy --prod`); set all env vars | 45 min |
| 3.3 | Smoke-test production: generate, save, reload, delete on the public URL | 30 min |
| 3.4 | Write `README.md` and `docs/TECHNICAL.md` | 90 min |
| 3.5 | Write `docs/DEMO_NOTES.md`; record a 2-min backup screen capture | 45 min |
| 3.6 | Polish: favicon, empty states, mobile check at 375px | 30 min |
| 3.7 | Commit docs on `docs` branch, deploy config on `deploy/netlify-config` — PRs, merge | 20 min |

**Milestone 3:** publicly accessible demo-ready app + complete docs + rehearsed 5-minute demo.

## Branch strategy

```
main                    ← always deployable
feature/frontend-ui     ← Day 1
feature/ai-extraction   ← Day 2
deploy/netlify-config   ← Day 3 (netlify.toml, .env.example)
docs                    ← README + docs/*
```

Every branch merges to `main` through a PR — that keeps the history readable and mirrors a real workflow.

## Risk watch-list

- **Captions missing** → the #1 failure mode; keep 2–3 known-good test links handy (see DEMO_NOTES).
- **OpenAI quota** → confirm the key works before Day 2 ends; `gpt-4o-mini` is the cheapest adequate model.
- **Scope creep** — search, auth, editing, and shopping lists are *post-demo* features. Write them down, don't build them.
