import { assertWriteAllowed, getActorContext, isRoomOwner, ownerOnlyResponse, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { indexArtifactFromBuffer } from "@/lib/artifacts/index";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

interface RouteProps {
  params: { artifactId: string };
}

// POST /api/artifacts/:artifactId/reindex
export async function POST(req: Request, { params }: RouteProps) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const supabase = createSupabaseServiceClient();
  const { data: artifact } = await supabase
    .from("artifacts")
    .select("id, room_id, name, mime_type, storage_path")
    .eq("id", params.artifactId)
    .single();

  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

  const canAccess = await verifyRoomAccess(supabase, artifact.room_id, actor);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const owner = await isRoomOwner(supabase, artifact.room_id, actor);
  if (!owner) return ownerOnlyResponse();

  const { data: blob, error: downloadError } = await supabase.storage
    .from("artifacts")
    .download(artifact.storage_path);

  if (downloadError || !blob) {
    return NextResponse.json({ error: downloadError?.message ?? "Failed to download artifact" }, { status: 500 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  await indexArtifactFromBuffer({
    supabase,
    artifactId: artifact.id,
    roomId: artifact.room_id,
    mimeType: artifact.mime_type,
    name: artifact.name,
    buffer,
  });

  const { data: refreshed } = await supabase
    .from("artifacts")
    .select("*")
    .eq("id", artifact.id)
    .single();

  return NextResponse.json({ artifact: refreshed ?? artifact, reindexed: true });
}
