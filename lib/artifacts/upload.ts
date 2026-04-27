import { indexArtifactFromBuffer } from "@/lib/artifacts/index";
import { getArtifactKind, isSupportedArtifactMime } from "@/lib/artifacts/extract";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function uploadArtifactFromFormData(args: {
  supabase: any;
  actorUserId: string | null;
  roomId: string;
  file: File;
}) {
  const { supabase, actorUserId, roomId, file } = args;
  if (!file) throw new Error("File is required");
  if (file.size <= 0) throw new Error("File is empty");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("File exceeds 20MB limit");

  const mimeType = file.type || "application/octet-stream";
  if (!isSupportedArtifactMime(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }

  const artifactName = sanitizeFilename(file.name || "artifact");
  const kind = getArtifactKind(mimeType);

  const { data: artifact, error: insertError } = await supabase
    .from("artifacts")
    .insert({
      room_id: roomId,
      uploaded_by: actorUserId,
      name: artifactName,
      mime_type: mimeType,
      size_bytes: file.size,
      storage_path: `pending/${Date.now()}-${artifactName}`,
      kind,
      parse_status: "pending",
    })
    .select()
    .single();

  if (insertError || !artifact) throw insertError ?? new Error("Failed to create artifact row");

  const storagePath = `${roomId}/${artifact.id}-${artifactName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("artifacts")
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) {
    await supabase.from("artifacts").delete().eq("id", artifact.id);
    throw uploadError;
  }

  await supabase.from("artifacts").update({ storage_path: storagePath }).eq("id", artifact.id);
  await indexArtifactFromBuffer({
    supabase,
    artifactId: artifact.id,
    roomId,
    mimeType,
    name: artifactName,
    buffer: fileBuffer,
  });

  const { data: refreshed } = await supabase.from("artifacts").select("*").eq("id", artifact.id).single();
  return refreshed ?? artifact;
}
