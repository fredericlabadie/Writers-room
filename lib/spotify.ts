import type { SectionMoodProfile } from "@/types";

let cachedToken: { value: string; expiresAt: number } | null = null;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function hasSpotifyCreds() {
  return !!env("SPOTIFY_CLIENT_ID") && !!env("SPOTIFY_CLIENT_SECRET");
}

export function parseSpotifyTrackId(input: string) {
  const raw = input.trim();
  if (!raw) return null;

  const uriMatch = raw.match(/^spotify:track:([a-zA-Z0-9]+)$/);
  if (uriMatch) return uriMatch[1];

  try {
    const url = new URL(raw);
    if (!url.hostname.includes("spotify.com")) return null;
    const match = url.pathname.match(/\/track\/([a-zA-Z0-9]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function getSpotifyAppToken() {
  if (!hasSpotifyCreds()) throw new Error("Spotify credentials not configured");
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - now > 60_000) return cachedToken.value;

  const clientId = env("SPOTIFY_CLIENT_ID");
  const clientSecret = env("SPOTIFY_CLIENT_SECRET");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Spotify token request failed");
  }
  const payload = await response.json() as { access_token: string; expires_in: number };
  cachedToken = {
    value: payload.access_token,
    expiresAt: now + payload.expires_in * 1000,
  };
  return payload.access_token;
}

function deriveMoodFromFeatures(input: {
  valence?: number;
  energy?: number;
  danceability?: number;
  acousticness?: number;
  instrumentalness?: number;
  tempo?: number;
}): Pick<SectionMoodProfile, "moodLabel" | "descriptors" | "guidance"> {
  const valence = input.valence ?? 0.5;
  const energy = input.energy ?? 0.5;
  const danceability = input.danceability ?? 0.5;
  const acousticness = input.acousticness ?? 0.5;
  const instrumentalness = input.instrumentalness ?? 0.2;
  const tempo = input.tempo ?? 110;

  const descriptors: string[] = [];
  if (energy >= 0.7) descriptors.push("driving");
  if (energy <= 0.35) descriptors.push("subtle");
  if (valence >= 0.65) descriptors.push("uplifting");
  if (valence <= 0.35) descriptors.push("melancholic");
  if (danceability >= 0.7) descriptors.push("rhythmic");
  if (acousticness >= 0.6) descriptors.push("organic");
  if (instrumentalness >= 0.5) descriptors.push("cinematic");
  if (tempo >= 130) descriptors.push("urgent");
  if (tempo <= 85) descriptors.push("slow-burn");
  if (!descriptors.length) descriptors.push("balanced");

  let moodLabel = "balanced cinematic";
  if (energy >= 0.7 && valence >= 0.6) moodLabel = "bold and optimistic";
  else if (energy >= 0.7 && valence <= 0.4) moodLabel = "intense and ominous";
  else if (energy <= 0.4 && valence <= 0.4) moodLabel = "introspective and somber";
  else if (energy <= 0.4 && valence >= 0.6) moodLabel = "warm and reflective";

  const guidance = `Write this section with a ${moodLabel} tone. Lean into ${descriptors.slice(0, 3).join(", ")} pacing and imagery.`;
  return { moodLabel, descriptors, guidance };
}

function fallbackMoodFromMetadata(trackName: string, artistName: string): SectionMoodProfile {
  const lowered = `${trackName} ${artistName}`.toLowerCase();
  const dark = ["dark", "night", "cold", "shadow", "pain"].some((token) => lowered.includes(token));
  const warm = ["sun", "gold", "light", "love", "home"].some((token) => lowered.includes(token));
  const moodLabel = dark ? "moody and tense" : warm ? "warm and hopeful" : "cinematic balanced";
  return {
    moodLabel,
    descriptors: dark ? ["brooding", "tense", "atmospheric"] : warm ? ["hopeful", "gentle", "open"] : ["cinematic", "balanced"],
    guidance: `Write this section with a ${moodLabel} tone and maintain emotional continuity.`,
    source: "spotify_metadata_fallback",
  };
}

export function parseSpotifyPlaylistId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const uriMatch = raw.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uriMatch) return uriMatch[1];

  try {
    const url = new URL(raw);
    if (!url.hostname.includes("spotify.com")) return null;
    const match = url.pathname.match(/\/playlist\/([a-zA-Z0-9]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export type PlaylistListeningDigest = {
  playlistId: string;
  playlistName: string;
  trackCount: number;
  analyzedTrackCount: number;
  avgFeatures: {
    valence: number;
    energy: number;
    danceability: number;
    acousticness: number;
    instrumentalness: number;
    tempo: number;
  };
  mood: ReturnType<typeof deriveMoodFromFeatures>;
  sampleTrackLines: string[];
};

/** Public playlist metadata + averaged audio features (client-credentials). */
export async function fetchPlaylistListeningDigest(playlistUrl: string): Promise<PlaylistListeningDigest> {
  const playlistId = parseSpotifyPlaylistId(playlistUrl);
  if (!playlistId) throw new Error("Invalid Spotify playlist link");

  if (!hasSpotifyCreds()) {
    throw new Error("Spotify credentials missing. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
  }

  const token = await getSpotifyAppToken();
  const headers = { Authorization: `Bearer ${token}` };

  const plRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, { headers });
  if (!plRes.ok) {
    throw new Error("Could not load playlist. Use a public playlist link.");
  }
  const plJson = await plRes.json() as { name?: string; tracks?: { total?: number } };
  const playlistName = plJson?.name ?? "Playlist";
  const total = plJson?.tracks?.total ?? 0;

  const tracksRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=80`,
    { headers },
  );
  if (!tracksRes.ok) {
    throw new Error("Could not read playlist tracks.");
  }
  const tracksPayload = await tracksRes.json() as { items?: Array<{ track: { id?: string; name?: string; artists?: Array<{ name?: string }> } | null }> };
  const items = tracksPayload.items ?? [];

  const trackIds: string[] = [];
  const sampleTrackLines: string[] = [];
  for (const row of items) {
    const t = row?.track;
    if (!t?.id) continue;
    trackIds.push(t.id);
    const artists = Array.isArray(t.artists) ? t.artists.map((a) => a.name).filter(Boolean).join(", ") : "";
    if (sampleTrackLines.length < 18) {
      sampleTrackLines.push(`${artists ? `${artists} — ` : ""}${t.name ?? "Unknown"}`);
    }
  }

  if (!trackIds.length) {
    throw new Error("No playable tracks found in this playlist.");
  }

  const featureChunks: string[][] = [];
  for (let i = 0; i < trackIds.length; i += 100) {
    featureChunks.push(trackIds.slice(i, i + 100));
  }

  const allFeatures: Array<{
    valence?: number;
    energy?: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    tempo?: number;
  }> = [];

  for (const chunk of featureChunks) {
    const q = chunk.join(",");
    const fr = await fetch(`https://api.spotify.com/v1/audio-features?ids=${q}`, { headers });
    if (!fr.ok) continue;
    const fj = await fr.json() as { audio_features?: Array<Record<string, unknown> | null> };
    for (const f of fj.audio_features ?? []) {
      if (!f || typeof f !== "object") continue;
      allFeatures.push({
        valence: Number(f.valence),
        energy: Number(f.energy),
        danceability: Number(f.danceability),
        acousticness: Number(f.acousticness),
        instrumentalness: Number(f.instrumentalness),
        tempo: Number(f.tempo),
      });
    }
  }

  let avgFeatures = {
    valence: 0.5,
    energy: 0.5,
    danceability: 0.5,
    acousticness: 0.5,
    instrumentalness: 0.2,
    tempo: 110,
  };

  if (allFeatures.length) {
    const n = allFeatures.length;
    type Sums = { valence: number; energy: number; danceability: number; acousticness: number; instrumentalness: number; tempo: number };
    const zero: Sums = { valence: 0, energy: 0, danceability: 0, acousticness: 0, instrumentalness: 0, tempo: 0 };
    const sum = allFeatures.reduce<Sums>(
      (acc, f) => ({
        valence: acc.valence + (Number.isFinite(f.valence) ? f.valence! : 0.5),
        energy: acc.energy + (Number.isFinite(f.energy) ? f.energy! : 0.5),
        danceability: acc.danceability + (Number.isFinite(f.danceability) ? f.danceability! : 0.5),
        acousticness: acc.acousticness + (Number.isFinite(f.acousticness) ? f.acousticness! : 0.5),
        instrumentalness: acc.instrumentalness + (Number.isFinite(f.instrumentalness) ? f.instrumentalness! : 0.2),
        tempo: acc.tempo + (Number.isFinite(f.tempo) ? f.tempo! : 110),
      }),
      zero,
    );
    avgFeatures = {
      valence: sum.valence / n,
      energy: sum.energy / n,
      danceability: sum.danceability / n,
      acousticness: sum.acousticness / n,
      instrumentalness: sum.instrumentalness / n,
      tempo: sum.tempo / n,
    };
  }

  const mood = deriveMoodFromFeatures(avgFeatures);

  return {
    playlistId,
    playlistName,
    trackCount: total || trackIds.length,
    analyzedTrackCount: trackIds.length,
    avgFeatures,
    mood,
    sampleTrackLines,
  };
}

export async function extractMoodFromSpotifyTrack(spotifyUrl: string) {
  const trackId = parseSpotifyTrackId(spotifyUrl);
  if (!trackId) throw new Error("Invalid Spotify track link");

  if (!hasSpotifyCreds()) {
    throw new Error("Spotify credentials missing. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.");
  }

  const token = await getSpotifyAppToken();
  const headers = { Authorization: `Bearer ${token}` };

  const [trackRes, featuresRes] = await Promise.all([
    fetch(`https://api.spotify.com/v1/tracks/${trackId}`, { headers }),
    fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, { headers }),
  ]);

  if (!trackRes.ok) throw new Error("Could not load track metadata from Spotify");
  const track = await trackRes.json() as any;
  const trackName = track?.name ?? "Unknown Track";
  const artistName = Array.isArray(track?.artists) ? track.artists.map((a: any) => a.name).join(", ") : "Unknown Artist";

  if (!featuresRes.ok) {
    return {
      trackId,
      trackName,
      artistName,
      mood: fallbackMoodFromMetadata(trackName, artistName),
    };
  }

  const features = await featuresRes.json() as any;
  const metrics = {
    valence: Number(features?.valence ?? 0),
    energy: Number(features?.energy ?? 0),
    danceability: Number(features?.danceability ?? 0),
    acousticness: Number(features?.acousticness ?? 0),
    instrumentalness: Number(features?.instrumentalness ?? 0),
    tempo: Number(features?.tempo ?? 0),
  };
  const derived = deriveMoodFromFeatures(metrics);
  return {
    trackId,
    trackName,
    artistName,
    mood: {
      ...derived,
      source: "spotify_audio_features" as const,
      metrics,
    },
  };
}
