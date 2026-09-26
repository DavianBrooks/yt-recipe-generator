import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptVideoUnavailableError,
} from 'youtube-transcript';
import { Innertube } from 'youtubei.js';
import { extractVideoId } from '../../src/lib/videoId.js';

const BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_URL = `${BASE}/chat/completions`;
const WHISPER_URL = `${BASE}/audio/transcriptions`;
const MAX_TRANSCRIPT_CHARS = 24000;
const MAX_AUDIO_BYTES = 22 * 1024 * 1024; // stay under Groq/OpenAI's 25MB upload cap

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

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

// No-captions fallback: pull the audio track and transcribe it with Whisper.
// Works on OpenAI (whisper-1) and Groq (whisper-large-v3-turbo).
async function transcribeAudio(videoId) {
  const yt = await Innertube.create();
  const info = await yt.getInfo(videoId);
  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  if (!format) throw new Error('No audio stream found for this video.');
  const audioUrl = format.decipher(yt.session.player);
  const res = await fetch(audioUrl);
  if (!res.ok || !res.body) throw new Error(`Audio download failed (HTTP ${res.status})`);

  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_AUDIO_BYTES) {
      await reader.cancel();
      throw new Error('Audio file is too large to transcribe (>22MB).');
    }
    chunks.push(value);
  }
  const audio = new Blob(chunks, { type: 'audio/mp4' });

  const form = new FormData();
  form.append('file', audio, 'audio.m4a');
  form.append('model', process.env.WHISPER_MODEL || 'whisper-large-v3-turbo');
  const wr = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  const wdata = await wr.json().catch(() => ({}));
  if (!wr.ok) {
    throw new Error(wdata?.error?.message || `Audio transcription failed (HTTP ${wr.status})`);
  }
  return (wdata.text || '').replace(/\s+/g, ' ').trim();
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
      // No captions — fall back to transcribing the audio with Whisper.
      try {
        transcript = await transcribeAudio(videoId);
      } catch (we) {
        return json(422, {
          error: `No captions on this video, and audio transcription failed (${we.message}). Try a video with subtitles enabled.`,
        });
      }
      if (!transcript) {
        return json(422, { error: 'Audio transcription produced no text.' });
      }
    } else {
      return json(502, {
        error: 'Could not fetch the video transcript — YouTube may be blocking server requests.',
      });
    }
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
