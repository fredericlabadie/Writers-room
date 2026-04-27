import { assertWriteAllowed, getActorContext, unauthorizedResponse, verifyRoomAccess } from "@/lib/authz";
import { retrieveRelevantChunks } from "@/lib/artifacts/retrieve";
import { PERSONAS, buildContextString } from "@/lib/personas";
import { createSupabaseServiceClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { PersonaId } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONTEXT_TAIL_COUNT = 16;
const EARLY_MESSAGE_PREVIEW_CHARS = 140;

function buildPrompt(
  userMessage: string,
  history: Array<{ role: string; persona?: string; content: string; user_name?: string }>,
  personaName: string,
  artifactContext: string
) {
  if (!history.length) {
    return `The user just said: "${userMessage}"\n\nRespond as ${personaName}.`;
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

  const { personaId, userMessage, roomId, history, selectedArtifactIds } = await req.json() as {
    personaId: PersonaId;
    userMessage: string;
    roomId: string;
    history: Array<{ role: string; persona?: string; content: string; user_name?: string }>;
    selectedArtifactIds?: string[];
  };

  const persona = PERSONAS[personaId];
  if (!persona) {
    return NextResponse.json({ error: "Unknown persona" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const canAccess = await verifyRoomAccess(supabase, roomId, actor);
  if (!canAccess) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
  }

  const retrieved = await retrieveRelevantChunks({
    supabase,
    roomId,
    query: `${userMessage}\n${history.slice(-4).map((msg) => msg.content).join("\n")}`,
    selectedArtifactIds,
    limit: 6,
    threshold: 0.14,
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
    await supabase.from("messages").insert({
      room_id: roomId,
      role: "agent",
      persona: personaId,
      content: text,
      citations,
    });

    return NextResponse.json({ text, citations });
  } catch (err) {
    console.error("Anthropic error:", err);
    return NextResponse.json({ error: "Model call failed" }, { status: 500 });
  }
}
