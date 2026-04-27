import { auth } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

// GET /api/rooms — list rooms the user belongs to
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("room_members")
    .select(`
      role,
      rooms (
        id, name, description, is_private, owner_id, invite_code, created_at,
        room_members (count)
      )
    `)
    .eq("user_id", session.user.id)
    .order("joined_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/rooms — create a new room
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, is_private } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const inviteCode = nanoid(8);

  const { data: room, error } = await supabase
    .from("rooms")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      owner_id: session.user.id,
      is_private: !!is_private,
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add creator as owner member
  await supabase.from("room_members").insert({
    room_id: room.id,
    user_id: session.user.id,
    role: "owner",
  });

  return NextResponse.json(room, { status: 201 });
}
