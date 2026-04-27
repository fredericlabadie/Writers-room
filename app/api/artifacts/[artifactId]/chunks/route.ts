import { getActorContext, isRoomOwner, ownerOnlyResponse, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

interface RouteProps {
  params: { artifactId: string };
}

// GET /api/artifacts/:artifactId/chunks
export async function GET(req: Request, { params }: RouteProps) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();

  const supabase = createSupabaseServiceClient();
  const { data: artifact } = await supabase
    .from("artifacts")
    .select("id, room_id, name")
    .eq("id", params.artifactId)
    .single();

  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

  const canAccess = await verifyRoomAccess(supabase, artifact.room_id, actor);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const owner = await isRoomOwner(supabase, artifact.room_id, actor);
  if (!owner) return ownerOnlyResponse();

  const { data: chunks, error } = await supabase
    .from("artifact_chunks")
    .select("id, chunk_index, content")
    .eq("artifact_id", artifact.id)
    .order("chunk_index", { ascending: true })
    .limit(120);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    artifact: { id: artifact.id, name: artifact.name },
    chunks: chunks ?? [],
  });
}
