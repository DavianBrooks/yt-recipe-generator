# Demo Preparation Notes

## Pre-demo checklist (do this the morning of)

- [ ] Deploy is live and env vars are set on Netlify (`OPENAI_API_KEY`, `VITE_PARSE_*`)
- [ ] Do one full run yourself 30 min before presenting — OpenAI cold calls are slower
- [ ] Have **2–3 pre-verified video links** ready in a note — see below
- [ ] Clear `My cookbook` down to 1–2 good saved recipes (a populated cookbook reads better than an empty one)
- [ ] Open the Back4App dashboard's `Recipe` class in a second tab — showing the row appear live is the strongest moment of the demo
- [ ] Record a 2-minute backup screen capture of the full flow in case live infra fails
- [ ] Zoom the browser to ~125% — ingredients text must be readable from the back of the room

## Known-good test videos

Verify these yourself before the demo — caption availability changes. Pick well-captioned cooking channels (e.g. recipe-style videos under ~15 min for speed):

1. A short recipe video (3–8 min) — **primary demo link**: fast transcript, fast extraction
2. A longer one (15–20 min) — **impressive backup** showing it handles real content
3. A non-recipe video (e.g. a music video) — **optional wow moment** showing the `not_a_recipe` guard

## 5-minute demo script

1. **(30s) Problem:** "Recipes on YouTube are great to watch but impossible to cook from — no ingredient list, you scrub the timeline for quantities."
2. **(15s) Solution:** "Paste a link, get a structured recipe, keep a cookbook." — show the live URL.
3. **(90s) Live extraction:** paste link #1 → talk through what's happening while it loads (captions → LLM → JSON, ~10–30s) → recipe appears. Point at the ingredients with quantities and the ordered steps.
4. **(30s) Save:** click *Save to my cookbook* → flip to the Back4App tab → show the new row. "No backend code, no SQL — Parse schemaless storage."
5. **(30s) Cookbook:** open *My cookbook*, show grid, reopen a recipe, delete the throwaway one.
6. **(45s) Architecture:** one sentence per box — React front-end, Netlify serverless function (keeps the API key server-side), YouTube captions + OpenAI, Back4App Parse.
7. **(30s) Wrap:** honest limits (needs captions; shared cookbook, no auth) → what's next (Whisper fallback, user accounts, caching by video ID).

## Anticipated Q&A

| Question | Answer |
|---|---|
| How does it get the recipe without watching the video? | YouTube captions — `youtube-transcript` fetches the caption track, the LLM structures it. |
| What about videos without subtitles? | Clean 422 error today; a Whisper audio-transcription fallback is the planned upgrade. |
| Where's the API key? | Server-side in a Netlify env var — the function is the only thing that talks to OpenAI. |
| Why Back4App and not a SQL DB? | Parse is schemaless — the `Recipe` class is created on first save; zero migrations; free tier. |
| Why React over Vue/Svelte? | Biggest ecosystem and hiring pool; Vite + Netlify have first-class React support. |
| Cost per recipe? | A few thousand tokens of `gpt-4o-mini` — fractions of a cent per extraction. |
| Does it hallucinate quantities? | Prompt forbids inventing amounts — unknown fields come back empty; temperature 0.2. |

## If something fails live

- **Extraction errors** → the error banner is part of the demo; say "this is the graceful failure path" and switch to link #2.
- **Netlify/OpenAI down** → play the backup screen capture and narrate over it.
- **Back4App hiccup** → the generate path still works; skip to architecture and show the dashboard tab.
