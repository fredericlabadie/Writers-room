// GET /api/r/[token] — validate a review link token and return room snapshot
// Used by the public /r/[token] page

import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

type Params = { params: { token: string } };

export async function GET(_req: Request, { params }: Params) {
  const supabase = createSupabaseServiceClient();

  // Validate token
  const { data: link } = await supabase
    .from("review_links")
    .select("id, room_id, created_by, expires_at, created_at")
    .eq("token", params.token)
    .single();

  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: "Link expired" }, { status: 410 });
  }

  // Fetch room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, description, room_type, created_at")
    .eq("id", link.room_id)
    .single();

  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  // Fetch creator profile
  const { data: creator } = link.created_by
    ? await supabase.from("profiles").select("name").eq("id", link.created_by).single()
    : { data: null };

  // Fetch messages (no sensitive fields)
  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, persona, content, created_at, user_name")
    .eq("room_id", link.room_id)
    .order("created_at", { ascending: true });

  // Fetch folder name if room is in one
  let folderName: string | null = null;
  const { data: roomRow } = await supabase.from("rooms").select("folder_id").eq("id", link.room_id).single();
  if (roomRow?.folder_id) {
    const { data: folder } = await supabase.from("folders").select("name").eq("id", roomRow.folder_id).single();
    folderName = folder?.name ?? null;
  }

  return NextResponse.json({
    room,
    messages: messages ?? [],
    link: {
      expiresAt: link.expires_at,
      createdAt: link.created_at,
      creatorName: creator?.name ?? null,
    },
    folderName,
  });
}
