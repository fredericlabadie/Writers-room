import Anthropic from "@anthropic-ai/sdk";
import type { PlaylistListeningDigest } from "@/lib/spotify";

const MODEL = "claude-sonnet-4-5";

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");
  return new Anthropic({ apiKey: key });
}

function extractJsonObject<T>(text: string): T {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return parseable JSON");
  }
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

export type BookToPlaylistTrack = { title: string; artist: string; whyItFits: string };
export type BookToPlaylistResult = {
  playlistName: string;
  rationale: string;
  moodTags: string[];
  tracks: BookToPlaylistTrack[];
};

export async function recommendPlaylistFromBook(input: {
  bookTitle: string;
  bookAuthor: string;
  bookNotes?: string;
}): Promise<BookToPlaylistResult> {
  const anthropic = getClient();
  const payload = [
    `Title: ${input.bookTitle}`,
    `Author: ${input.bookAuthor}`,
    input.bookNotes?.trim() ? `Notes / genre / vibe: ${input.bookNotes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2200,
    temperature: 0.75,
    system: `You are a music supervisor for readers. Given a book, propose a Spotify-style listening playlist.

Rules:
- Output ONLY a single JSON object (no markdown outside the JSON).
- Shape: {"playlistName": string, "rationale": string, "moodTags": string[], "tracks": [{"title": string, "artist": string, "whyItFits": string}]}
- 12–18 tracks. Use real recordings that exist on Spotify (well-known artists preferred).
- Match tone, era, geography, and emotional arc implied by the book.
- "whyItFits" is one short sentence each.`,
    messages: [{ role: "user", content: `Build a playlist for this book:\n\n${payload}` }],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const parsed = extractJsonObject<BookToPlaylistResult>(text);
  if (!parsed.playlistName || !Array.isArray(parsed.tracks) || parsed.tracks.length < 6) {
    throw new Error("Invalid playlist recommendation shape");
  }
  return parsed;
}

export type PlaylistToBookItem = {
  title: string;
  author: string;
  whyItFits: string;
};
export type PlaylistToBookResult = {
  rationale: string;
  books: PlaylistToBookItem[];
};

export async function recommendBooksFromPlaylist(digest: PlaylistListeningDigest): Promise<PlaylistToBookResult> {
  const anthropic = getClient();
  const digestText = [
    `Playlist: ${digest.playlistName}`,
    `Tracks in playlist (reported): ${digest.trackCount}. Analyzed for audio: ${digest.analyzedTrackCount}.`,
    `Mood label: ${digest.mood.moodLabel}`,
    `Descriptors: ${digest.mood.descriptors.join(", ")}`,
    `Avg audio (0–1 except tempo BPM): valence ${digest.avgFeatures.valence.toFixed(2)}, energy ${digest.avgFeatures.energy.toFixed(2)}, danceability ${digest.avgFeatures.danceability.toFixed(2)}, acousticness ${digest.avgFeatures.acousticness.toFixed(2)}, tempo ~${Math.round(digest.avgFeatures.tempo)}`,
    "",
    "Sample tracks:",
    digest.sampleTrackLines.slice(0, 15).map((l) => `- ${l}`).join("\n"),
  ].join("\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    temperature: 0.55,
    system: `You are a librarian matching music to fiction.

Rules:
- Output ONLY a single JSON object (no markdown outside the JSON).
- Shape: {"rationale": string, "books": [{"title": string, "author": string, "whyItFits": string}]}
- Recommend 6–10 published novels or story collections (mix of famous and lesser-known is fine).
- "whyItFits" ties the book's mood, themes, or pacing to the playlist in one sentence.`,
    messages: [{ role: "user", content: `Recommend books that fit this playlist listening profile:\n\n${digestText}` }],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const parsed = extractJsonObject<PlaylistToBookResult>(text);
  if (!Array.isArray(parsed.books) || parsed.books.length < 3) {
    throw new Error("Invalid book recommendation shape");
  }
  return parsed;
}
