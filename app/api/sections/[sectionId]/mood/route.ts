import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { extractMoodFromSpotifyTrack } from "@/lib/spotify";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

interface RouteProps {
  params: { sectionId: string };
}

// POST /api/sections/:sectionId/mood
export async function POST(req: Request, { params }: RouteProps) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const { spotifyUrl } = await req.json();
  if (!spotifyUrl) return NextResponse.json({ error: "spotifyUrl required" }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const { data: section } = await supabase
    .from("room_sections")
    .select("id, room_id")
    .eq("id", params.sectionId)
    .single();

  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  const canAccess = await verifyRoomAccess(supabase, section.room_id, actor);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const spotify = await extractMoodFromSpotifyTrack(spotifyUrl);
    const { data, error } = await supabase
      .from("room_sections")
      .update({
        spotify_url: spotifyUrl,
        spotify_track_id: spotify.trackId,
        spotify_track_name: spotify.trackName,
        spotify_artist_name: spotify.artistName,
        mood_profile: spotify.mood,
      })
      .eq("id", params.sectionId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ section: data, mood: spotify.mood });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to extract mood";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
