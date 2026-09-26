---
name: testing-yt-recipe-generator
description: How to run and test the YouTube Recipe Generator app locally (branch merge, node PATH, netlify dev vs vite dev, expected error states without secrets)
---

# Testing yt-recipe-generator locally

## Environment
- Node 22 is installed at `~/node` but NOT on PATH. Always run `export PATH=$HOME/node/bin:$PATH` first.
- `npm run dev` = plain Vite on :5173 (front-end only; `/.netlify/functions/*` calls will 404).
- Preferred: `npx --yes netlify-cli dev --port 8888` — first run downloads ~380 MB of netlify-cli (takes ~1 min), then spawns Vite on 5173 and proxies app + functions on :8888. Function output may be buffered if piped through `head`; verify readiness with `curl -s http://localhost:8888/` instead of waiting for stdout.
- Quick function check: `curl -s -X POST http://localhost:8888/.netlify/functions/extract-recipe -H 'Content-Type: application/json' -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'`

## Repo layout quirk
- `main` may contain only the scaffold; feature code can live on unmerged branches (e.g. feature/frontend-ui, feature/ai-extraction, deploy/netlify-config, docs). Create a local merged branch to test the real app: `git checkout -b test/merged && git merge <branches>`. Untracked leftovers identical to branch contents must be removed first or merge refuses to overwrite them.

## Expected error states (no secrets)
- No `OPENAI_API_KEY`: valid YouTube URL submit → banner "OPENAI_API_KEY is not configured on the server." (netlify dev) or generic HTTP error (plain vite).
- No `VITE_PARSE_APP_ID`/`VITE_PARSE_JS_KEY`: "My cookbook" tab shows "Back4App is not configured" empty-state.
- URL input is `type="url"`: non-URL garbage triggers the browser's native "Please enter a URL" bubble, NOT the app's custom "That does not look like a YouTube URL." — use a valid-format non-YouTube URL (e.g. https://vimeo.com/12345) to exercise the custom message.
- Devin Secrets Needed for full extraction/save testing: `OPENAI_API_KEY` (server function) and `VITE_PARSE_APP_ID` + `VITE_PARSE_JS_KEY` (Back4App cookbook persistence).

## Mobile check
- `@media (max-width: 640px)` collapses the form row and recipe header to column. Resize the Chrome window to ~375–400px with `wmctrl -r "<window title>" -b remove,maximized_vert,maximized_horz` then `wmctrl -r "<window title>" -e 0,50,20,400,728`.
