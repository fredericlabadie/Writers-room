import { assertWriteAllowed, getActorContext, unauthorizedResponse } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// GET /api/folders — list folders the user owns or is a member of
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();
  const userId = session.user.id;

  const supabase = createSupabaseServiceClient();

  const { data: owned } = await supabase
    .from("folders")
    .select("id, name, description, owner_id, genre, reader, tone, about, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  const { data: memberRows } = await supabase
    .from("folder_members")
    .select("folder_id")
    .eq("user_id", userId);

  const memberFolderIds = (memberRows ?? []).map((r: any) => r.folder_id);
  const ownedIds = new Set((owned ?? []).map((f: any) => f.id));

  let memberFolders: any[] = [];
  if (memberFolderIds.length > 0) {
    const ids = memberFolderIds.filter((id: string) => !ownedIds.has(id));
    if (ids.length > 0) {
      const { data } = await supabase
        .from("folders")
        .select("id, name, description, owner_id, genre, reader, tone, about, created_at")
        .in("id", ids);
      memberFolders = data ?? [];
    }
  }

  const allFolders = [...(owned ?? []), ...memberFolders];

  // Attach room_count and pin_count
  const withCounts = await Promise.all(allFolders.map(async (folder: any) => {
    const [{ count: roomCount }, { count: pinCount }] = await Promise.all([
      supabase.from("rooms").select("id", { count: "exact", head: true }).eq("folder_id", folder.id),
      supabase.from("folder_pins").select("id", { count: "exact", head: true }).eq("folder_id", folder.id),
    ]);
    return { ...folder, room_count: roomCount ?? 0, pin_count: pinCount ?? 0 };
  }));

  return NextResponse.json(withCounts);
}

// POST /api/folders — create a new folder
export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const { name, description, genre, reader, tone, about } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const supabase = createSupabaseServiceClient();

  const { data: folder, error } = await supabase
    .from("folders")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      owner_id: actor.userId,
      genre: genre?.trim() || null,
      reader: reader?.trim() || null,
      tone: tone?.trim() || null,
      about: about?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("folder_members").insert({
    folder_id: folder.id,
    user_id: actor.userId,
    role: "owner",
  });

  return NextResponse.json(folder, { status: 201 });
}
