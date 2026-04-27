const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;

export interface TextChunk {
  chunkIndex: number;
  content: string;
}

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number }
): TextChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunkSize = Math.max(200, options?.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const overlap = Math.max(0, Math.min(chunkSize - 100, options?.overlap ?? DEFAULT_CHUNK_OVERLAP));

  const chunks: TextChunk[] = [];
  let cursor = 0;
  let chunkIndex = 0;

  while (cursor < normalized.length) {
    const end = Math.min(normalized.length, cursor + chunkSize);
    const slice = normalized.slice(cursor, end).trim();
    if (slice) {
      chunks.push({ chunkIndex, content: slice });
      chunkIndex += 1;
    }
    if (end >= normalized.length) break;
    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}
