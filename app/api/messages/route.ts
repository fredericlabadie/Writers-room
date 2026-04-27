import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// GET /api/messages?roomId=xxx — load history
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
    .from("messages")
    .select(`*, profiles (name, avatar_url), room_sections (name)`)
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messageIds = (data ?? []).map((m: any) => m.id);
  if (!messageIds.length) return NextResponse.json(data ?? []);

  const { data: links } = await supabase
    .from("message_artifacts")
    .select("message_id, artifact_id")
    .in("message_id", messageIds);

  const map = new Map<string, string[]>();
  for (const link of links ?? []) {
    const list = map.get(link.message_id) ?? [];
    list.push(link.artifact_id);
    map.set(link.message_id, list);
  }

  const withArtifacts = (data ?? []).map((msg: any) => ({
    ...msg,
    artifact_ids: map.get(msg.id) ?? [],
    section_name: msg.room_sections?.name ?? null,
  }));
  return NextResponse.json(withArtifacts);
}

// POST /api/messages — save a user message
export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const { roomId, content, artifactIds, sectionId } = await req.json();
  if (!roomId || !content) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const canAccess = await verifyRoomAccess(supabase, roomId, actor);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (sectionId) {
    const { data: section } = await supabase
      .from("room_sections")
      .select("id")
      .eq("id", sectionId)
      .eq("room_id", roomId)
      .single();
    if (!section) return NextResponse.json({ error: "Invalid sectionId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ room_id: roomId, role: "user", user_id: actor.userId, content, section_id: sectionId ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(artifactIds) && artifactIds.length) {
    const links = artifactIds.map((artifactId) => ({ message_id: data.id, artifact_id: artifactId }));
    await supabase.from("message_artifacts").insert(links);
  }

  return NextResponse.json(data, { status: 201 });
}
