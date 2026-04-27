import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

interface RouteProps {
  params: { artifactId: string };
}

// DELETE /api/artifacts/:artifactId
export async function DELETE(req: Request, { params }: RouteProps) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const supabase = createSupabaseServiceClient();
  const { data: artifact } = await supabase
    .from("artifacts")
    .select("id, room_id, storage_path")
    .eq("id", params.artifactId)
    .single();

  if (!artifact) return NextResponse.json({ error: "Artifact not found" }, { status: 404 });

  const canAccess = await verifyRoomAccess(supabase, artifact.room_id, actor);
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.storage.from("artifacts").remove([artifact.storage_path]);
  await supabase.from("artifacts").delete().eq("id", artifact.id);

  return NextResponse.json({ ok: true });
}
