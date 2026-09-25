import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptVideoUnavailableError,
} from 'youtube-transcript';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MAX_TRANSCRIPT_CHARS = 24000;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function extractVideoId(input) {
  let url;
  try {
    url = new URL(input.startsWith('http') ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com') {
    const v = url.searchParams.get('v');
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = url.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/);
    if (m) return m[2];
  }
  return null;
}

async function fetchOembed(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return {
    channelTitle: data.author_name ?? null,
    thumbnail: data.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videoTitle: data.title ?? null,
  };
}

async function fetchTranscript(videoId) {
  const segments = await YoutubeTranscript.fetchTranscript(videoId);
  return segments
    .map((s) => s.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYSTEM_PROMPT = `You are a recipe extraction engine. Given the title and transcript of a YouTube cooking video, produce a single structured recipe as JSON.

Return ONLY a JSON object with exactly these keys:
{
  "title": string,              // recipe name (not the video title unless they match)
  "description": string,        // 1-2 sentence summary
  "servings": string,           // e.g. "4" or "4-6"; "" if unknown
  "prepTime": string,           // e.g. "15 min"; "" if unknown
  "cookTime": string,           // e.g. "30 min"; "" if unknown
  "cuisine": string,            // e.g. "Italian"; "" if unknown
  "difficulty": string,         // "Easy" | "Medium" | "Hard"; "" if unknown
  "ingredients": [
    { "item": string, "quantity": string, "unit": string, "notes": string }
  ],
  "steps": [
    { "order": number, "instruction": string, "duration": string }
  ],
  "tags": string[]              // 3-8 short tags, e.g. ["vegetarian", "one-pot", "quick"]
}

Rules:
- Infer quantities from the narration whenever stated or visually implied; use "" for unknown fields, never invent precise amounts the video does not mention.
- Merge duplicate ingredients; keep quantities in the units the chef used.
- Steps must be chronological, imperative, and self-contained (someone can cook from them without watching).
- If the video is not actually a cooking/recipe video, return {"error": "not_a_recipe"} instead.`;

async function callOpenAI(videoTitle, transcript) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Video title: ${videoTitle || 'unknown'}\n\nTranscript:\n${transcript}`,
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `OpenAI request failed (HTTP ${res.status})`;
    const err = new Error(msg);
    err.status = 502;
    throw err;
  }
  return JSON.parse(data.choices[0].message.content);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed — use POST' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Request body must be JSON: {"url": "..."}' });
  }

  const { url } = body;
  if (!url || typeof url !== 'string') {
    return json(400, { error: 'Missing required field: url' });
  }

  const videoId = extractVideoId(url.trim());
  if (!videoId) {
    return json(400, { error: 'Could not parse a YouTube video ID from that URL.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(500, { error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  const meta = await fetchOembed(videoId).catch(() => null);
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  let transcript;
  try {
    transcript = await fetchTranscript(videoId);
  } catch (e) {
    if (e instanceof YoutubeTranscriptVideoUnavailableError) {
      return json(404, { error: 'That YouTube video is unavailable or private.' });
    }
    if (
      e instanceof YoutubeTranscriptDisabledError ||
      e instanceof YoutubeTranscriptNotAvailableError
    ) {
      return json(422, {
        error:
          'No captions are available for this video (or YouTube is rate-limiting the server). Try a video with subtitles enabled.',
      });
    }
    return json(502, {
      error: 'Could not fetch the video transcript — YouTube may be blocking server requests.',
    });
  }
  if (!transcript) {
    return json(422, { error: 'The transcript for this video is empty.' });
  }

  try {
    const recipe = await callOpenAI(
      meta?.videoTitle,
      transcript.slice(0, MAX_TRANSCRIPT_CHARS),
    );
    if (recipe.error === 'not_a_recipe') {
      return json(422, { error: 'This video does not appear to contain a recipe.' });
    }
    return json(200, {
      ...recipe,
      videoId,
      videoUrl: canonicalUrl,
      channelTitle: meta?.channelTitle ?? null,
      thumbnail: meta?.thumbnail ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  } catch (e) {
    return json(e.status || 500, { error: e.message || 'Recipe extraction failed.' });
  }
};
