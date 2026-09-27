# 4-Minute Demo Script — YouTube Recipe Generator

Live app: https://yt-recipe-generator-davian.netlify.app
Repo: https://github.com/DavianBrooks/yt-recipe-generator

Total runtime: ~4:00. Practice once with a timer; each section has a hard cutoff.

---

## Setup before recording (don't film this)

- Open two browser tabs: **(1)** the live app, **(2)** Firebase Console → your project → Firestore Database (data view, `recipes` collection).
- Have VS Code open on the repo folder for the code section.
- Clear the cookbook if you want a clean save/delete demo — or keep 1–2 saved recipes to make the cookbook look populated.
- Pick the demo video: `https://www.youtube.com/watch?v=EVpBQPw6xTk` (Gordon Ramsay — verified working).
- Close notifications, bookmarks bar extras, and anything personal on screen.

---

## 0:00–0:30 — Intro & proof of deployment

> "This is YouTube Recipe Generator — a web app that turns any cooking video into a structured, saveable recipe. It's fully deployed on Netlify — note the public URL in the address bar, this isn't localhost. The front end is React, the backend is a Netlify serverless function, and recipes are stored in Firebase Firestore."

**On screen:** live app landing page. Hover/scroll slightly so the food-collage background is visible. Point at the URL bar.

## 0:30–1:00 — Registration & login

> "Anyone can use it, but accounts keep a persistent cookbook. On the landing page I can sign up with email and password…"

**On screen:** type email + password → click **Create account**. Show the signed-in state (email + Sign out button).

> "Behind the scenes that's Firebase Authentication. Signing out returns to a guest session — guests get an anonymous cookbook automatically, and signing up links it so nothing is lost."

**On screen (optional quick):** click Sign out, show guest hint, sign back in.

## 1:00–2:10 — Core flow + database functionality

> "Now the main feature. I'll paste a Gordon Ramsay video URL and hit Generate."

**On screen:** paste URL → Generate. While it runs (~20–30s):

> "The serverless function pulls the video's captions — on Netlify's servers that goes through the Supadata API since YouTube blocks datacenter traffic — then Groq's LLM converts the narration into structured JSON: ingredients with quantities, ordered steps, cuisine, difficulty, tags."

When the recipe renders, scroll it briefly:

> "There's the recipe — 14 ingredients, timed steps. I can **Edit** any field before saving. I'll save it to my cookbook…"

**On screen:** click **Save to my cookbook** → switch to the **Firebase Firestore tab** — show the new document appearing in `recipes` (refresh the console if needed).

> "That document you just saw appear is the record in Firestore — scoped to my user id. Back in the app, **My cookbook** lists my recipes with search and cuisine/tag filters."

**On screen:** cookbook tab → reopen the recipe → show **Share link** (a public `?r=` URL) → **Print/PDF** briefly → delete a recipe and show it disappearing from Firestore.

## 2:10–3:30 — Code & project structure

> "Quick code tour. The structure is deliberately simple…"

**On screen:** VS Code file explorer + each file opened briefly.

> "`src/App.jsx` is the root — it manages the Generate/Cookbook tabs and all state. `api.js` wraps every backend call — extraction, Firestore save/list/delete, share links, and a cache check so re-submitting a video loads instantly instead of re-calling the AI.
>
> `netlify/functions/extract-recipe.mjs` is the serverless function — about 200 lines. It validates the URL, gets a video ID, tries captions first, then Supadata, then a Whisper audio fallback, and finally calls the LLM with a strict JSON schema prompt — it returns a recipe object or a clean error.
>
> `src/lib/firebase.js` handles auth — anonymous sign-in for guests, email/password linking for accounts. `firestore.rules` scopes each cookbook to its owner and allows public reads only for explicitly shared recipes.
>
> Styling is plain CSS in `index.css`, including the print stylesheet and the collage background. Docs live in `docs/` — a technical spec, a 3-day build plan, and these demo notes."

## 3:30–4:00 — Wrap-up

> "To recap: React front-end deployed on Netlify, a serverless AI pipeline doing the extraction, Firebase for auth and per-user storage, all versioned on GitHub with feature branches and PR history. Thanks for watching."

**On screen:** back to the app — the finished recipe card or cookbook view.

---

## Contingencies

- **Generation stalls or rate-limits:** the app auto-retries (~20s). If it still fails, pivot to a saved recipe and say "here's one generated earlier" — keep moving.
- **Firestore console slow:** narrate the save flow anyway; the cookbook view in-app is the same proof.
- **Forgot password mid-demo:** sign out → sign up with a second email, or stay as guest — guests can still save (if Anonymous provider is enabled).
