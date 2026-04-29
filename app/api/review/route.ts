// POST /api/review — create a shareable read-only review link for a room
// Called from the "Share review link" modal in WritersRoom.tsx
// Returns { url, expiresAt }

import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const { roomId, expiresInHours = 72 } = await req.json();
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const canAccess = await verifyRoomAccess(supabase, roomId, actor);
  if (!canAccess) return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });

  const token = nanoid(24);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("review_links").insert({
    room_id: roomId,
    token,
    created_by: actor.userId,
    expires_at: expiresAt,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  return NextResponse.json({
    url: `${baseUrl}/r/${token}`,
    expiresAt,
  }, { status: 201 });
}
