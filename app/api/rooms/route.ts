import { assertWriteAllowed, getActorContext, unauthorizedResponse } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

// GET /api/rooms — list rooms the user belongs to
export async function GET(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();

  const supabase = createSupabaseServiceClient();
  let data: any[] | null = null;
  let error: any = null;

  if (actor.mode === "review") {
    const out = await supabase
      .from("rooms")
      .select("id, name, description, is_private, owner_id, invite_code, created_at")
      .order("created_at", { ascending: false });
    error = out.error;
    data = (out.data ?? []).map((room: any) => ({ role: "reviewer", rooms: room }));
  } else {
    const out = await supabase
      .from("room_members")
      .select(`
        role,
        rooms (
          id, name, description, is_private, owner_id, invite_code, created_at,
          room_members (count)
        )
      `)
      .eq("user_id", actor.userId)
      .order("joined_at", { ascending: false });
    error = out.error;
    data = out.data;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/rooms — create a new room
export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const { name, description, is_private } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const inviteCode = nanoid(8);

  const { data: room, error } = await supabase
    .from("rooms")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      owner_id: actor.userId,
      is_private: !!is_private,
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add creator as owner member
  if (actor.userId) {
    await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: actor.userId,
      role: "owner",
    });
  }

  return NextResponse.json(room, { status: 201 });
}
