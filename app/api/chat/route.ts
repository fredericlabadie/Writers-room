import { auth } from "@/lib/auth";
import { PERSONAS, buildContextString } from "@/lib/personas";
import { createSupabaseServiceClient } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { PersonaId } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONTEXT_TAIL_COUNT = 16;
const EARLY_MESSAGE_PREVIEW_CHARS = 140;

function buildPrompt(userMessage: string, history: Array<{ role: string; persona?: string; content: string; user_name?: string }>, personaName: string) {
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
    `The user just said: "${userMessage}"`,
    "",
    `Respond as ${personaName}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  // Auth check — no session = 401
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { personaId, userMessage, roomId, history } = await req.json() as {
    personaId: PersonaId;
    userMessage: string;
    roomId: string;
    history: Array<{ role: string; persona?: string; content: string; user_name?: string }>;
  };

  const persona = PERSONAS[personaId];
  if (!persona) {
    return NextResponse.json({ error: "Unknown persona" }, { status: 400 });
  }

  // Verify user is a member of this room
  const supabase = createSupabaseServiceClient();
  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", session.user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
  }

  const prompt = buildPrompt(userMessage, history, persona.name);

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
    await supabase.from("messages").insert({
      room_id: roomId,
      role: "agent",
      persona: personaId,
      content: text,
    });

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Anthropic error:", err);
    return NextResponse.json({ error: "Model call failed" }, { status: 500 });
  }
}
