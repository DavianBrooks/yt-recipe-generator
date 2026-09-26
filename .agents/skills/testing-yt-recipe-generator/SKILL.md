---
name: testing-yt-recipe-generator
description: How to run and test the YouTube Recipe Generator app locally (branch state, node PATH, netlify dev vs vite dev, expected error states with/without secrets)
---

# Testing yt-recipe-generator locally

## Environment
- Node 22 is installed at `~/node` but NOT on PATH. Always run `export PATH=$HOME/node/bin:$PATH` first.
- `npm run dev` = plain Vite on :5173 (front-end only; `/.netlify/functions/*` calls will 404).
- Preferred: `npx --yes netlify-cli dev --port 8888` — first run downloads ~380 MB of netlify-cli (takes ~1 min), then spawns Vite on 5173 and proxies app + functions on :8888. Verify readiness with `curl -s http://localhost:8888/` — function load output may be buffered if piped.
- `netlify dev` injects `.env` vars (check for a `.env` file — OPENAI_API_KEY may be present even if the env has no credits).
- Quick function check: `curl -s -X POST http://localhost:8888/.netlify/functions/extract-recipe -H 'Content-Type: application/json' -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'`

## Repo layout quirk
- Feature work may live on unmerged branches; main may only have the scaffold or partially merged PRs. Check `git branch`/`git log` before assuming what's live — create a local merged branch if needed (`git checkout -b test/merged && git merge <branches>`). Untracked leftovers identical to branch contents must be removed first or merge refuses to overwrite them.

## Expected error states
- Storage is Firebase Firestore. No `VITE_FIREBASE_API_KEY`/`VITE_FIREBASE_PROJECT_ID`/`VITE_FIREBASE_APP_ID` → "My cookbook" shows "Firebase is not configured" empty-state. (Older code used Back4App/Parse with VITE_PARSE_* — if you see that text, the build is stale.)
- URL input is `type="url"`: non-URL garbage triggers the browser's native "Please enter a URL" bubble, NOT the custom "That does not look like a YouTube URL." — use a valid-format non-YouTube URL (e.g. https://vimeo.com/12345) to exercise the custom message.
- `OPENAI_API_KEY` unset → banner "OPENAI_API_KEY is not configured on the server."; key set but out of credits → banner "You have no credits remaining. Add credits to continue…" after ~1s of real work (transcript fetch + OpenAI round-trip — this deeper error still proves graceful handling).
- The function supports `OPENAI_BASE_URL` + `OPENAI_MODEL` env overrides (PR #9) — Groq's OpenAI-compatible endpoint (`https://api.groq.com/openai/v1`) works as an extraction backend; recipe generation takes ~10–30s, wait before screenshotting the result.
- Full E2E (generate → save → cookbook → reopen → delete) is exercisable when a working LLM key AND `VITE_FIREBASE_*` creds are set. Verify Firestore writes/deletes server-side with the REST probe: `curl "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/(default)/documents/recipes?key=$KEY"` — empty collection returns `{}`.
- Devin Secrets Needed for full end-to-end: a working `OPENAI_API_KEY` (or `OPENAI_BASE_URL`/`OPENAI_MODEL` pointing at an alternative like Groq) plus `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.

## Mobile check
- `@media (max-width: 640px)` collapses the form row and recipe header to column. Resize Chrome to ~375–400px: `wmctrl -r "<window title>" -b remove,maximized_vert,maximized_horz` then `wmctrl -r "<window title>" -e 0,50,20,400,728`.
