import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// GET /api/sections?roomId=...
export async function GET(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get("roomId");
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const canAccess = await verifyRoomAccess(supabase, roomId, actor);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("room_sections")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/sections
export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const { roomId, name } = await req.json();
  if (!roomId || !name?.trim()) {
    return NextResponse.json({ error: "roomId and section name are required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const canAccess = await verifyRoomAccess(supabase, roomId, actor);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("room_sections")
    .insert({
      room_id: roomId,
      name: name.trim(),
      created_by: actor.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
