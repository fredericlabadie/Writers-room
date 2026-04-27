const VECTOR_DIMENSION = 256;

function normalizeVector(values: number[]) {
  const magnitude = Math.sqrt(values.reduce((acc, v) => acc + v * v, 0));
  if (magnitude === 0) return values;
  return values.map((v) => v / magnitude);
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildEmbedding(text: string) {
  const vector = new Array<number>(VECTOR_DIMENSION).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9][a-z0-9'-]{1,}/g) ?? [];

  for (const token of tokens) {
    const hash = hashToken(token);
    const bucket = hash % VECTOR_DIMENSION;
    vector[bucket] += 1;
  }

  return normalizeVector(vector);
}

export function cosineSimilarity(a: number[], b: number[]) {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function vectorToSqlLiteral(vector: number[]) {
  return `[${vector.map((v) => Number(v.toFixed(8))).join(",")}]`;
}

export function parseStoredVector(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map((n) => Number(n) || 0);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
    const body = trimmed.slice(1, -1);
    if (!body) return [];
    return body.split(",").map((n) => Number(n.trim()) || 0);
  }
  return [];
}
