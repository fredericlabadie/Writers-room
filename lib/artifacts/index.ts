import { chunkText } from "@/lib/artifacts/chunk";
import { buildEmbedding, vectorToSqlLiteral } from "@/lib/artifacts/embed";
import { extractArtifactText } from "@/lib/artifacts/extract";

export async function indexArtifactFromBuffer(args: {
  supabase: any;
  artifactId: string;
  roomId: string;
  mimeType: string;
  name: string;
  buffer: Buffer;
}) {
  const { supabase, artifactId, roomId, mimeType, name, buffer } = args;

  await supabase
    .from("artifacts")
    .update({ parse_status: "processing", parse_error: null })
    .eq("id", artifactId);

  try {
    const extracted = await extractArtifactText({ mimeType, name, buffer });
    const chunks = chunkText(extracted.text ?? "");

    await supabase.from("artifact_chunks").delete().eq("artifact_id", artifactId);

    if (chunks.length) {
      const rows = chunks.map((chunk) => ({
        artifact_id: artifactId,
        room_id: roomId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        embedding: vectorToSqlLiteral(buildEmbedding(chunk.content)),
      }));

      const { error } = await supabase.from("artifact_chunks").insert(rows);
      if (error) throw error;
    }

    const note = extracted.note ?? null;
    await supabase
      .from("artifacts")
      .update({ parse_status: "ready", parse_error: note })
      .eq("id", artifactId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown parsing error";
    await supabase
      .from("artifacts")
      .update({ parse_status: "failed", parse_error: message })
      .eq("id", artifactId);
    throw err;
  }
}
