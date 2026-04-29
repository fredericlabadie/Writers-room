import { assertWriteAllowed, getActorContext, unauthorizedResponse } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

type Params = { params: { folderId: string } };

async function verifyFolderAccess(supabase: any, folderId: string, userId: string) {
  const { data } = await supabase
    .from("folder_members")
    .select("role")
    .eq("folder_id", folderId)
    .eq("user_id", userId)
    .single();
  return data ? (data.role as "owner" | "member") : null;
}

// GET /api/folders/[folderId] — folder detail + rooms + pins
export async function GET(req: Request, { params }: Params) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();

  const supabase = createSupabaseServiceClient();
  const folderId = params.folderId;

  if (actor.mode === "user" && actor.userId) {
    const role = await verifyFolderAccess(supabase, folderId, actor.userId);
    if (!role) return NextResponse.json({ error: "Not a member of this folder" }, { status: 403 });
  }

  const [{ data: folder }, { data: pins }, { data: rooms }] = await Promise.all([
    supabase
      .from("folders")
      .select("*")
      .eq("id", folderId)
      .single(),
    supabase
      .from("folder_pins")
      .select("*")
      .eq("folder_id", folderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("rooms")
      .select("id, name, description, room_type, is_private, owner_id, created_at, folder_id")
      .eq("folder_id", folderId)
      .order("created_at", { ascending: false }),
  ]);

  if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });

  // Attach message stats to rooms
  const roomsWithStats = await Promise.all((rooms ?? []).map(async (room: any) => {
    const { data: msgs } = await supabase
      .from("messages")
      .select("created_at")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);
    return {
      ...room,
      message_count: count ?? 0,
      last_message_at: msgs?.[0]?.created_at ?? null,
    };
  }));

  return NextResponse.json({ folder, pins: pins ?? [], rooms: roomsWithStats });
}

// PATCH /api/folders/[folderId] — update folder lore
export async function PATCH(req: Request, { params }: Params) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const supabase = createSupabaseServiceClient();
  const folderId = params.folderId;

  if (actor.userId) {
    const role = await verifyFolderAccess(supabase, folderId, actor.userId);
    if (!role) return NextResponse.json({ error: "Not a member of this folder" }, { status: 403 });
  }

  const ALLOWED = ["name", "description", "genre", "reader", "tone", "about"] as const;
  const body = await req.json();
  const updates: Record<string, any> = {};
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]?.trim?.() || null;
  }

  const { data, error } = await supabase
    .from("folders")
    .update(updates)
    .eq("id", folderId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/folders/[folderId] — owner only; rooms are un-assigned (not deleted)
export async function DELETE(req: Request, { params }: Params) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const supabase = createSupabaseServiceClient();
  const folderId = params.folderId;

  if (actor.userId) {
    const role = await verifyFolderAccess(supabase, folderId, actor.userId);
    if (role !== "owner") return NextResponse.json({ error: "Only folder owners can delete folders" }, { status: 403 });
  }

  // Rooms keep their data; folder_id becomes null (via ON DELETE SET NULL)
  const { error } = await supabase.from("folders").delete().eq("id", folderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
