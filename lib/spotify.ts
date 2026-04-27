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
