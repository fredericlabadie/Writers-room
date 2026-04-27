import { buildEmbedding, cosineSimilarity, parseStoredVector } from "@/lib/artifacts/embed";
import type { ArtifactCitation } from "@/types";

interface ChunkRow {
  id: string;
  artifact_id: string;
  chunk_index: number;
  content: string;
  embedding: unknown;
  artifacts?: { name?: string } | null;
}

export interface RetrievedChunk {
  content: string;
  citation: ArtifactCitation;
}

export async function retrieveRelevantChunks(args: {
  supabase: any;
  roomId: string;
  query: string;
  selectedArtifactIds?: string[];
  limit?: number;
  threshold?: number;
}) {
  const queryEmbedding = buildEmbedding(args.query);
  let request = args.supabase
    .from("artifact_chunks")
    .select("id, artifact_id, chunk_index, content, embedding, artifacts(name)")
    .eq("room_id", args.roomId)
    .limit(250);

  if (args.selectedArtifactIds?.length) {
    request = request.in("artifact_id", args.selectedArtifactIds);
  }

  const { data, error } = await request;
  if (error || !data) return [];

  const threshold = args.threshold ?? 0.18;
  const scored = (data as ChunkRow[])
    .map((row) => {
      const embedding = parseStoredVector(row.embedding);
      const score = cosineSimilarity(queryEmbedding, embedding);
      return { row, score };
    })
    .filter((it) => it.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, args.limit ?? 5)
    .map<RetrievedChunk>((it) => ({
      content: it.row.content,
      citation: {
        artifactId: it.row.artifact_id,
        artifactName: it.row.artifacts?.name ?? "Artifact",
        chunkId: it.row.id,
        chunkIndex: it.row.chunk_index,
        score: Number(it.score.toFixed(4)),
      },
    }));

  return scored;
}
