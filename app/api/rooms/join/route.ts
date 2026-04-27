import { assertWriteAllowed, getActorContext, unauthorizedResponse } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// POST /api/rooms/join — join via invite code
export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;
  if (!actor.userId) {
    return NextResponse.json({ error: "Join is disabled for review-mode sessions" }, { status: 403 });
  }

  const { invite_code } = await req.json();
  if (!invite_code) return NextResponse.json({ error: "Invite code required" }, { status: 400 });

  const supabase = createSupabaseServiceClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("invite_code", invite_code)
    .single();

  if (!room) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });

  // Upsert membership (safe if already a member)
  await supabase.from("room_members").upsert(
    { room_id: room.id, user_id: actor.userId, role: "member" },
    { onConflict: "room_id,user_id" }
  );

  return NextResponse.json({ room_id: room.id, room_name: room.name });
}
