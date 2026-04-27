import { auth } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

interface Params { params: { roomId: string } }

// GET /api/rooms/[roomId] — room settings (used by WritersRoom on mount)
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServiceClient();

  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", params.roomId)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, description, is_private, invite_code, notebooklm_url, active_tone, owner_id")
    .eq("id", params.roomId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, userRole: membership.role });
}

// PATCH /api/rooms/[roomId] — update room settings (tone, notebooklm_url, etc.)
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServiceClient();

  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", params.roomId)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const allowed = ["notebooklm_url", "active_tone", "name", "description", "is_private"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("rooms")
    .update(update)
    .eq("id", params.roomId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/rooms/[roomId] — permanently delete a room (owner only)
// All related data (messages, members, artifacts, review_links) cascade via FK constraints.
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServiceClient();

  // Only the room owner can delete
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", params.roomId)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (membership.role !== "owner") {
    return NextResponse.json({ error: "Only the room owner can delete this room" }, { status: 403 });
  }

  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("id", params.roomId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
