import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { retrieveRelevantChunks } from "@/lib/artifacts/retrieve";
import { PERSONAS, buildContextString } from "@/lib/personas";
import { createSupabaseServiceClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { PersonaId, RetrievalDebugInfo, RetrievalSettings } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONTEXT_TAIL_COUNT = 16;
const EARLY_MESSAGE_PREVIEW_CHARS = 140;
const FILE_GENERATION_INSTRUCTIONS = [
  "If the user asks for a downloadable file, include one or more file blocks using this exact format:",
  "```file:filename.ext",
  "<full file content>",
  "```",
  "Use .txt or .md for text docs and .csv for spreadsheets.",
  "Do not truncate file content in file blocks.",
].join("\n");
const MIN_TOP_K = 1;
const MAX_TOP_K = 12;
const MIN_THRESHOLD = 0;
const MAX_THRESHOLD = 1;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildPrompt(
  userMessage: string,
  history: Array<{ role: string; persona?: string; content: string; user_name?: string }>,
  personaName: string,
  artifactContext: string
) {
  if (!history.length) {
    return [
      FILE_GENERATION_INSTRUCTIONS,
      "",
      `The user just said: "${userMessage}"`,
      "",
      `Respond as ${personaName}.`,
    ].join("\n");
  }

  const tail = history.slice(-CONTEXT_TAIL_COUNT);
  const earlier = history.slice(0, -CONTEXT_TAIL_COUNT);
  const context = buildContextString(tail);

  const earlierDigest = earlier.length
    ? earlier
        .slice(-6)
        .map((msg) => {
          const speaker = msg.role === "user"
            ? msg.user_name?.toUpperCase() ?? "USER"
            : (msg.persona ?? "AGENT").toUpperCase();
          const snippet = msg.content.replace(/\s+/g, " ").trim().slice(0, EARLY_MESSAGE_PREVIEW_CHARS);
          return `- [${speaker}] ${snippet}${msg.content.length > EARLY_MESSAGE_PREVIEW_CHARS ? "..." : ""}`;
        })
        .join("\n")
    : "";

  return [
    `Conversation context (${tail.length} most recent messages):`,
    "",
    context,
    "",
    earlier.length
      ? `Older context summary (${earlier.length} earlier messages):\n${earlierDigest}`
      : "",
    "",
    "---",
    "",
    artifactContext ? `Artifact context:\n${artifactContext}` : "",
    artifactContext ? "" : "",
    "---",
    "",
    `The user just said: "${userMessage}"`,
    "",
    FILE_GENERATION_INSTRUCTIONS,
    "",
    `Respond as ${personaName}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  const actor = await getActorContext(req);
  if (!actor) return unauthorizedResponse();
  const writeError = assertWriteAllowed(actor);
  if (writeError) return writeError;

  const body = await req.json() as {
    personaId: PersonaId;
    userMessage: string;
    roomId: string;
    history: Array<{ role: string; persona?: string; content: string; user_name?: string }>;
    retrieval?: Partial<RetrievalSettings>;
    selectedArtifactIds?: string[]; // legacy
  };
  const { personaId, userMessage, roomId, history } = body;

  const persona = PERSONAS[personaId];
  if (!persona) {
    return NextResponse.json({ error: "Unknown persona" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const canAccess = await verifyRoomAccess(supabase, roomId, actor);
  if (!canAccess) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
  }

  const requestedTopK = Number(body.retrieval?.topK ?? 6);
  const requestedThreshold = Number(body.retrieval?.threshold ?? 0.14);
  const mode = body.retrieval?.mode === "selected_only" ? "selected_only" : "room_wide";
  const topK = clamp(Number.isFinite(requestedTopK) ? requestedTopK : 6, MIN_TOP_K, MAX_TOP_K);
  const threshold = clamp(Number.isFinite(requestedThreshold) ? requestedThreshold : 0.14, MIN_THRESHOLD, MAX_THRESHOLD);
  const selectedArtifactIds = Array.isArray(body.retrieval?.selectedArtifactIds)
    ? body.retrieval?.selectedArtifactIds
    : Array.isArray(body.selectedArtifactIds)
      ? body.selectedArtifactIds
      : [];

  const retrieved = await retrieveRelevantChunks({
    supabase,
    roomId,
    query: `${userMessage}\n${history.slice(-4).map((msg) => msg.content).join("\n")}`,
    mode,
    selectedArtifactIds,
    limit: topK,
    threshold,
  });

  const artifactContext = retrieved
    .map((chunk, i) => `[${i + 1}] ${chunk.citation.artifactName} (chunk ${chunk.citation.chunkIndex}, score ${chunk.citation.score})\n${chunk.content}`)
    .join("\n\n");

  const prompt = buildPrompt(userMessage, history, persona.name, artifactContext);

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: persona.generation.maxTokens,
      temperature: persona.generation.temperature,
      system: persona.system,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Persist agent message to database
    const citations = retrieved.map((item) => item.citation);
    const retrievalDebug: RetrievalDebugInfo = {
      mode,
      topK,
      threshold,
      retrievedCount: retrieved.length,
      usedArtifactIds: Array.from(new Set(citations.map((citation) => citation.artifactId))),
      maxScore: citations.length ? Math.max(...citations.map((citation) => citation.score)) : 0,
    };
    await supabase.from("messages").insert({
      room_id: roomId,
      role: "agent",
      persona: personaId,
      content: text,
      citations,
      retrieval_debug: retrievalDebug,
    });

    return NextResponse.json({ text, citations, retrieval: retrievalDebug });
  } catch (err) {
    console.error("Anthropic error:", err);
    return NextResponse.json({ error: "Model call failed" }, { status: 500 });
  }
}
